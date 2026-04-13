// /api/submit.js — Vercel Serverless Function
// Receives onboarding form data, creates a .md brief in GitHub, emails Yosef

import { Octokit } from "@octokit/rest";
import { Resend } from "resend";

export default async function handler(req, res) {
  // CORS + method check
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const data = req.body;

    // Validate required fields
    if (!data.business_name || !data.contact_name || !data.email) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Format the markdown client brief
    const brief = formatBrief(data);
    const timestamp = new Date().toISOString().split("T")[0];
    const slug = data.business_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const filename = `${slug}-${timestamp}.md`;

    // 1. Create .md file in GitHub repo
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    const owner = "YosefBrodt";
    const repo = "client-intake";

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filename,
      message: `New intake: ${data.business_name}`,
      content: Buffer.from(brief).toString("base64"),
    });

    // 2. Send email notification (non-fatal — form always succeeds even if email fails)
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "Onboarding <onboarding@resend.dev>",
          to: "brodt.yosef@gmail.com",
          subject: `New Client Intake: ${data.business_name}`,
          text: `New onboarding form submitted by ${data.contact_name} (${data.business_name}).\n\nCheck your Obsidian vault or GitHub: https://github.com/${owner}/${repo}\n\n---\n\n${brief}`,
        });
      } catch (emailErr) {
        // Email failure is non-fatal — log it but don't block the response
        console.error("Email send failed:", emailErr.message);
      }
    }

    return res.status(200).json({ success: true, filename });
  } catch (err) {
    console.error("Submit error:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}

function formatBrief(d) {
  const now = new Date().toISOString().split("T")[0];

  return `---
client: "${d.business_name}"
contact: "${d.contact_name}"
email: "${d.email}"
phone: "${d.phone || ""}"
date: ${now}
status: intake
---

# ${d.business_name} — Client Intake

## Contact Info
| Field | Value |
|-------|-------|
| **Name** | ${d.contact_name} |
| **Role** | ${d.role || "—"} |
| **Email** | ${d.email} |
| **Phone** | ${d.phone || "—"} |
| **Location** | ${d.location || "—"} |
| **Industry** | ${d.industry || "—"} |
| **Service area** | ${d.service_area || "—"} |
| **Preferred contact** | ${d.preferred_contact || "—"} |
| **Socials** | ${d.socials || "—"} |

## Project Scope
- **Services requested:** ${d.services || "—"}
- **#1 goal:** ${d.primary_goal || "—"}
- **Deadline / driving event:** ${d.deadline || "None specified"}

## Domain & Current Site
- **Owns a domain:** ${d.has_domain || "—"}
- **Domain name:** ${d.domain_name || "—"}
- **Registrar:** ${d.registrar || "—"}
- **Domain preference:** ${d.domain_preference || "—"}
- **Current site URL:** ${d.current_site || "None"}
- **Built with:** ${d.current_platform || "—"}

## Branding & Style
- **Logo status:** ${d.logo_status || "—"}
- **Brand colors:** ${d.brand_colors || "—"}
- **Photos:** ${d.photos || "—"}
- **Reference sites:** ${d.reference_sites || "None provided"}

## Website Details
- **Pages needed:** ${d.pages || "—"}
- **Content status:** ${d.content_status || "—"}
- **Main services/products:** ${d.services_list || "—"}
- **Pricing display:** ${d.pricing_display || "—"}
- **Special features:** ${d.special_features || "—"}

## Google Profile & Reviews
- **GBP status:** ${d.gbp_status || "—"}
- **Google account access:** ${d.google_access || "—"}
- **Reviews situation:** ${d.reviews_status || "—"}

## Additional Notes
${d.additional_notes || "None"}

---
*Submitted via onboarding form on ${now}*
`;
}
