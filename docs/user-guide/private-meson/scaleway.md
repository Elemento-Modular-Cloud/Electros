# Scaleway (private Meson)

Collect Scaleway organisation, project, application, and API key values for Electros. Provider id: **`scaleway`**.

## What you need

| Field | How you get it |
|-------|----------------|
| `SCALEWAY_ORGANIZATION_ID` | Organisation dashboard → Copy ID |
| `SCALEWAY_PROJECT_ID` | Project dashboard → Copy ID |
| `SCALEWAY_APPLICATION_ID` | IAM → Applications |
| `SCALEWAY_API_KEY` / `SCALEWAY_SECRET_KEY` | IAM → API keys |

## Organisation ID

1. Open **Organization Dashboard** in the left sidebar.
2. Click **Copy ID** next to your organisation name.

![Scaleway organisation dashboard](../assets/private-meson-scaleway-1-org.png)

## Project ID

1. Open **Project Dashboard**. Use an existing project or create one. Select the correct project in the top dropdown next to the organisation name.
2. Click **Copy ID** next to the project name.

![Scaleway project dashboard](../assets/private-meson-scaleway-2-project.png)

## Application, policy, and API keys

1. Open **IAM** in the left sidebar.

![Scaleway IAM](../assets/private-meson-scaleway-3-iam.png)

2. Open **Applications** and create an application named `elemento-meson`.
3. Copy the application id into **`SCALEWAY_APPLICATION_ID`**.

![Scaleway application](../assets/private-meson-scaleway-4-application.png)

4. Open **Policies** and create a policy for that application.

![Create Scaleway policy](../assets/private-meson-scaleway-5-policy.png)

5. Add the rules Elemento Meson needs on the project, then confirm.

![Scaleway policy rules](../assets/private-meson-scaleway-6-rules-a.png)

![Scaleway policy rules continued](../assets/private-meson-scaleway-7-rules-b.png)

6. Open **API keys** and create a key. Select the correct project under Object Storage.

![Create Scaleway API key](../assets/private-meson-scaleway-8-api-key.png)

7. Copy the **Key ID** and the **secret** when shown.

## Finish in Electros

1. **Connections** → **Add Provider** → **Private** → **Scaleway**.
2. Paste the organisation, project, application, and API key values.
3. **Conclude**, then enable the target on **Active Connections**.
