package ui

import (
	"sort"
	"strings"
)

// CloudFlavourCatalog mirrors GUI cloudInstanceFlavours.ts catalogues.
type CloudFlavourCatalog struct {
	ID          string
	DisplayName string
	ShortLabel  string
}

// CloudInstanceFlavour mirrors GUI cloud instance flavour entries.
type CloudInstanceFlavour struct {
	ID              string
	CatalogID       string
	Name            string
	VCPUs           int
	RAMGiB          int
	BlockStorageGiB int
	Description     string
}

var cloudFlavourCatalogs = []CloudFlavourCatalog{
	{ID: "aws", DisplayName: "Amazon Web Services (EC2)", ShortLabel: "AWS"},
	{ID: "azure", DisplayName: "Microsoft Azure", ShortLabel: "Azure"},
	{ID: "google", DisplayName: "Google Cloud (Compute Engine)", ShortLabel: "GCP"},
	{ID: "ovh", DisplayName: "OVHcloud", ShortLabel: "OVH"},
	{ID: "scaleway", DisplayName: "Scaleway", ShortLabel: "Scaleway"},
}

var cloudInstanceFlavours = []CloudInstanceFlavour{
	{ID: "aws-t3.micro", CatalogID: "aws", Name: "t3.micro", VCPUs: 2, RAMGiB: 1, BlockStorageGiB: 8, Description: "Burstable, general purpose"},
	{ID: "aws-t3.small", CatalogID: "aws", Name: "t3.small", VCPUs: 2, RAMGiB: 2, BlockStorageGiB: 20, Description: "Burstable, general purpose"},
	{ID: "aws-t3.medium", CatalogID: "aws", Name: "t3.medium", VCPUs: 2, RAMGiB: 4, BlockStorageGiB: 30, Description: "Burstable, general purpose"},
	{ID: "aws-t3.large", CatalogID: "aws", Name: "t3.large", VCPUs: 2, RAMGiB: 8, BlockStorageGiB: 50, Description: "Burstable, general purpose"},
	{ID: "aws-m5.large", CatalogID: "aws", Name: "m5.large", VCPUs: 2, RAMGiB: 8, BlockStorageGiB: 80, Description: "Balanced compute"},
	{ID: "aws-m5.xlarge", CatalogID: "aws", Name: "m5.xlarge", VCPUs: 4, RAMGiB: 16, BlockStorageGiB: 100, Description: "Balanced compute"},
	{ID: "aws-c5.large", CatalogID: "aws", Name: "c5.large", VCPUs: 2, RAMGiB: 4, BlockStorageGiB: 40, Description: "Compute optimized"},
	{ID: "aws-r5.large", CatalogID: "aws", Name: "r5.large", VCPUs: 2, RAMGiB: 16, BlockStorageGiB: 60, Description: "Memory optimized"},
	{ID: "azure-B1s", CatalogID: "azure", Name: "B1s", VCPUs: 1, RAMGiB: 1, BlockStorageGiB: 8, Description: "Burstable"},
	{ID: "azure-B2s", CatalogID: "azure", Name: "B2s", VCPUs: 2, RAMGiB: 4, BlockStorageGiB: 16, Description: "Burstable"},
	{ID: "azure-D2s_v5", CatalogID: "azure", Name: "D2s_v5", VCPUs: 2, RAMGiB: 8, BlockStorageGiB: 30, Description: "General purpose"},
	{ID: "azure-D4s_v5", CatalogID: "azure", Name: "D4s_v5", VCPUs: 4, RAMGiB: 16, BlockStorageGiB: 60, Description: "General purpose"},
	{ID: "azure-E2s_v5", CatalogID: "azure", Name: "E2s_v5", VCPUs: 2, RAMGiB: 16, BlockStorageGiB: 40, Description: "Memory optimized"},
	{ID: "azure-F2s_v2", CatalogID: "azure", Name: "F2s_v2", VCPUs: 2, RAMGiB: 4, BlockStorageGiB: 32, Description: "Compute optimized"},
	{ID: "google-e2-micro", CatalogID: "google", Name: "e2-micro", VCPUs: 2, RAMGiB: 1, BlockStorageGiB: 10, Description: "Cost-optimized"},
	{ID: "google-e2-small", CatalogID: "google", Name: "e2-small", VCPUs: 2, RAMGiB: 2, BlockStorageGiB: 20, Description: "Cost-optimized"},
	{ID: "google-e2-medium", CatalogID: "google", Name: "e2-medium", VCPUs: 2, RAMGiB: 4, BlockStorageGiB: 30, Description: "Cost-optimized"},
	{ID: "google-n2-standard-2", CatalogID: "google", Name: "n2-standard-2", VCPUs: 2, RAMGiB: 8, BlockStorageGiB: 50, Description: "Balanced"},
	{ID: "google-n2-standard-4", CatalogID: "google", Name: "n2-standard-4", VCPUs: 4, RAMGiB: 16, BlockStorageGiB: 80, Description: "Balanced"},
	{ID: "google-c2-standard-4", CatalogID: "google", Name: "c2-standard-4", VCPUs: 4, RAMGiB: 16, BlockStorageGiB: 60, Description: "Compute optimized"},
	{ID: "ovh-b2-7", CatalogID: "ovh", Name: "b2-7", VCPUs: 2, RAMGiB: 7, BlockStorageGiB: 25, Description: "General purpose"},
	{ID: "ovh-b2-15", CatalogID: "ovh", Name: "b2-15", VCPUs: 4, RAMGiB: 15, BlockStorageGiB: 50, Description: "General purpose"},
	{ID: "ovh-c2-7", CatalogID: "ovh", Name: "c2-7", VCPUs: 2, RAMGiB: 7, BlockStorageGiB: 25, Description: "CPU optimized"},
	{ID: "ovh-r2-15", CatalogID: "ovh", Name: "r2-15", VCPUs: 2, RAMGiB: 15, BlockStorageGiB: 40, Description: "RAM optimized"},
	{ID: "scaleway-DEV1-S", CatalogID: "scaleway", Name: "DEV1-S", VCPUs: 2, RAMGiB: 2, BlockStorageGiB: 10, Description: "Development"},
	{ID: "scaleway-DEV1-M", CatalogID: "scaleway", Name: "DEV1-M", VCPUs: 3, RAMGiB: 4, BlockStorageGiB: 20, Description: "Development"},
	{ID: "scaleway-GP1-S", CatalogID: "scaleway", Name: "GP1-S", VCPUs: 2, RAMGiB: 8, BlockStorageGiB: 40, Description: "General purpose"},
	{ID: "scaleway-GP1-M", CatalogID: "scaleway", Name: "GP1-M", VCPUs: 4, RAMGiB: 16, BlockStorageGiB: 80, Description: "General purpose"},
}

func catalogShortLabel(catalogID string) string {
	for _, c := range cloudFlavourCatalogs {
		if c.ID == catalogID {
			return c.ShortLabel
		}
	}
	return catalogID
}

func flavoursForCatalog(catalogID string) []CloudInstanceFlavour {
	out := make([]CloudInstanceFlavour, 0)
	for _, f := range cloudInstanceFlavours {
		if f.CatalogID == catalogID {
			out = append(out, f)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func findCloudFlavour(id string) *CloudInstanceFlavour {
	for i := range cloudInstanceFlavours {
		if cloudInstanceFlavours[i].ID == id {
			return &cloudInstanceFlavours[i]
		}
	}
	return nil
}

func filterFlavours(catalogID, search string) []CloudInstanceFlavour {
	all := flavoursForCatalog(catalogID)
	q := strings.TrimSpace(strings.ToLower(search))
	if q == "" {
		return all
	}
	out := make([]CloudInstanceFlavour, 0, len(all))
	for _, f := range all {
		hay := strings.ToLower(f.Name + " " + f.Description)
		if strings.Contains(hay, q) {
			out = append(out, f)
		}
	}
	return out
}
