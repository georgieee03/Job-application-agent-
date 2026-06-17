# Local Secrets Manifest

This file lists local-only items needed to run the automation on a Mac. Do not
commit the actual secrets. Store them in Google Drive, a password manager, or
another private location and restore them locally after cloning.

## Do Not Commit

- `.env`
- `.env.*`
- `application-profile.json` if it contains personal answers you do not want in
  git
- `job-sources.json` if it contains private provider keys or webhook URLs
- Chrome or Playwright browser profiles
- OAuth tokens
- mailbox credentials or app passwords
- OTP/security-code files
- Gmail exports containing private email bodies

## Needed For Full Automation

| Item | Local Path On Mac | Purpose | Required? |
| --- | --- | --- | --- |
| Environment variables | `.env` | Search providers, webhooks, optional email verification settings | Yes |
| Application profile | `application-profile.json` | Repeated form answers for the older workbench helpers | Recommended |
| Job sources | `job-sources.json` | Company boards and aggregator configuration | Recommended |
| Mailbox access method | local secret or browser login | Confirmation email verification | Required for email-verified status |
| Dedicated Chrome profile | local browser profile outside git | Logged-in ATS/email sessions when needed | Optional |
| GitHub credentials | macOS keychain / `gh auth login` / SSH key | Push tracker updates back to GitHub | Recommended |

## Email Verification Principle

Claude Code may search only the authorized mailbox/account you provide. It must
not retain OTPs or raw credentials. Evidence should be summarized in the tracker
without storing secrets.

## Suggested Private Storage

Create a Google Drive folder named:

```text
Job Application Agent Local Secrets
```

Store:

- `.env`
- `application-profile.json`
- `job-sources.json`
- a short note describing how to access the confirmation mailbox or which Chrome
  profile to use

Do not place Chrome profile folders in git.
