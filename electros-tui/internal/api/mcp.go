package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const agentPollInterval = 900 * time.Millisecond

type agentSendStart struct {
	OK             bool   `json:"ok"`
	JobID          string `json:"job_id"`
	Error          string `json:"error"`
	ActiveJobID    string `json:"active_job_id"`
	ThreadID       string `json:"thread_id"`
	ConversationID string `json:"conversation_id"`
	Status         string `json:"status"`
}

type agentJobPoll struct {
	OK             bool             `json:"ok"`
	Status         string           `json:"status"`
	NextSince      int              `json:"next_since"`
	Error          string           `json:"error"`
	Assistant      string           `json:"assistant"`
	ThreadID       string           `json:"thread_id"`
	ConversationID string           `json:"conversation_id"`
	Result         map[string]any   `json:"result"`
	MitlPending    bool             `json:"mitl_pending"`
	Events         []agentJobEvent  `json:"events"`
}

type agentJobEvent struct {
	Message string `json:"message"`
}

func (c *Client) agentRoot() string {
	return strings.TrimRight(c.MCPBaseURL(), "/") + "/proxy/llm/agent"
}

// SendMCPPrompt runs an Electra agent turn via the MCP proxy (same API as the GUI).
func (c *Client) SendMCPPrompt(ctx context.Context, prompt string, threadID string) (map[string]any, error) {
	body := map[string]any{
		"user_message": prompt,
		"poll":         true,
		"max_steps":    6,
	}
	if threadID != "" {
		body["thread_id"] = threadID
		body["conversation_id"] = threadID
	}

	start, err := c.startAgentRun(ctx, body)
	if err != nil {
		return nil, err
	}

	jobID := start.JobID
	if start.Error == "thread_busy" && start.ActiveJobID != "" {
		jobID = start.ActiveJobID
	}
	if jobID == "" {
		return nil, fmt.Errorf("SendMCPPrompt: agent run did not return a job_id")
	}

	poll, err := c.pollAgentJobUntilTerminal(ctx, jobID)
	if err != nil {
		return nil, err
	}

	if poll.Status == "failed" {
		msg := strings.TrimSpace(poll.Error)
		if msg == "" {
			msg = "The agent run failed."
		}
		return nil, fmt.Errorf("SendMCPPrompt: %s", msg)
	}

	text := extractAssistantText(poll)
	if poll.MitlPending && text == "" {
		text = "Confirmation required — complete the action in the Electros GUI."
	} else if poll.MitlPending {
		text += "\n\n(Confirmation required — complete the action in the Electros GUI.)"
	}
	if text == "" {
		text = "(no assistant response)"
	}

	outThread := poll.ThreadID
	if outThread == "" {
		outThread = poll.ConversationID
	}
	if outThread == "" {
		outThread = threadID
	}

	return map[string]any{
		"response":  text,
		"thread_id": outThread,
	}, nil
}

func (c *Client) startAgentRun(ctx context.Context, body map[string]any) (agentSendStart, error) {
	var start agentSendStart
	data, err := json.Marshal(body)
	if err != nil {
		return start, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.agentRoot(), bytes.NewReader(data))
	if err != nil {
		return start, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return start, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return start, err
	}

	if resp.StatusCode == http.StatusUnauthorized {
		return start, &UnauthorizedError{Op: "SendMCPPrompt", Detail: string(raw)}
	}
	if resp.StatusCode == http.StatusConflict {
		if err := json.Unmarshal(raw, &start); err != nil {
			return start, fmt.Errorf("SendMCPPrompt: thread busy: %s", string(raw))
		}
		return start, nil
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if len(raw) == 0 {
			return start, fmt.Errorf("SendMCPPrompt: HTTP %d", resp.StatusCode)
		}
		return start, fmt.Errorf("SendMCPPrompt: HTTP %d: %s", resp.StatusCode, string(raw))
	}

	if err := json.Unmarshal(raw, &start); err != nil {
		return start, err
	}
	return start, nil
}

func (c *Client) pollAgentJobUntilTerminal(ctx context.Context, jobID string) (*agentJobPoll, error) {
	since := 0
	for {
		var poll agentJobPoll
		pollURL := fmt.Sprintf("%s/jobs/%s?since=%d", c.agentRoot(), url.PathEscape(jobID), since)
		if err := c.get(ctx, pollURL, "PollAgentJob", &poll); err != nil {
			return nil, err
		}
		if poll.NextSince >= since {
			since = poll.NextSince
		}
		switch poll.Status {
		case "completed", "mitl_pending", "failed":
			return &poll, nil
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(agentPollInterval):
		}
	}
}

func extractAssistantText(poll *agentJobPoll) string {
	if poll == nil {
		return ""
	}
	if s := strings.TrimSpace(poll.Assistant); s != "" {
		return s
	}
	if poll.Result != nil {
		for _, key := range []string{"assistant", "assistant_message", "final_answer", "output", "response"} {
			if v, ok := poll.Result[key].(string); ok && strings.TrimSpace(v) != "" {
				return v
			}
		}
	}
	return ""
}

// MCPHealth reports whether the MCP HTTP endpoint responds (JSON-RPC initialize probe).
func (c *Client) MCPHealth(ctx context.Context) bool {
	body := map[string]any{
		"jsonrpc": "2.0",
		"id":      0,
		"method":  "initialize",
		"params": map[string]any{
			"protocolVersion": "2024-11-05",
			"capabilities":    map[string]any{},
			"clientInfo": map[string]string{
				"name":    "electros-tui",
				"version": "0.1.0",
			},
		},
	}
	data, err := json.Marshal(body)
	if err != nil {
		return false
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.MCPBaseURL()+"/", bytes.NewReader(data))
	if err != nil {
		return false
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")

	resp, err := c.http.Do(req)
	if err != nil {
		return false
	}
	resp.Body.Close()
	return true
}
