#!/usr/bin/env python3
"""Public Ashby application helper.

This helper supports:
- describing a public Ashby job form and survey structure
- replaying the public GraphQL mutations Ashby uses for file upload, field saves,
  and final submission

Important: raw shell/API submission can still be rejected by Ashby's anti-spam
scoring on some boards, even with a fresh browser-minted reCAPTCHA token. The
`submit` command is still useful for fast replays, dry-runs, and form mapping,
but boards with stricter scoring may require a browser-backed final submit.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
from pathlib import Path
from typing import Any

import requests


JOB_QUERY = """
query ApiJobPosting($organizationHostedJobsPageName: String!, $jobPostingId: String!) {
  jobPosting(
    organizationHostedJobsPageName: $organizationHostedJobsPageName
    jobPostingId: $jobPostingId
  ) {
    id
    title
    locationName
    departmentName
    applicationForm {
      id
      sourceFormDefinitionId
      formControls { identifier title __typename }
      sections {
        title
        descriptionHtml
        fieldEntries {
          id
          isRequired
          isHidden
          field
          __typename
        }
        __typename
      }
      __typename
    }
    surveyForms {
      id
      sourceFormDefinitionId
      formControls { identifier title __typename }
      sections {
        title
        descriptionHtml
        fieldEntries {
          id
          isRequired
          isHidden
          field
          __typename
        }
        __typename
      }
      __typename
    }
    __typename
  }
}
""".strip()

CREATE_UPLOAD_HANDLE_MUTATION = """
mutation ApiCreateFileUploadHandle(
  $organizationHostedJobsPageName: String!,
  $fileUploadContext: FileUploadContext!,
  $filename: String!,
  $contentType: String!,
  $contentLength: Int!
) {
  fileUploadHandle: createFileUploadHandle(
    organizationHostedJobsPageName: $organizationHostedJobsPageName
    fileUploadContext: $fileUploadContext
    filename: $filename
    contentType: $contentType
    contentLength: $contentLength
  ) {
    handle
    url
    fields
    __typename
  }
}
""".strip()

SET_FORM_VALUE_MUTATION = """
mutation ApiSetFormValue(
  $organizationHostedJobsPageName: String!,
  $formRenderIdentifier: String!,
  $path: String!,
  $value: JSON,
  $formDefinitionIdentifier: String
) {
  setFormValue(
    organizationHostedJobsPageName: $organizationHostedJobsPageName
    formRenderIdentifier: $formRenderIdentifier
    path: $path
    value: $value
    formDefinitionIdentifier: $formDefinitionIdentifier
  ) {
    id
    __typename
  }
}
""".strip()

SET_FORM_VALUE_TO_FILE_MUTATION = """
mutation ApiSetFormValueToFile(
  $organizationHostedJobsPageName: String!,
  $formRenderIdentifier: String!,
  $path: String!,
  $fileHandle: String,
  $formDefinitionIdentifier: String
) {
  setFormValueToFile(
    organizationHostedJobsPageName: $organizationHostedJobsPageName
    formRenderIdentifier: $formRenderIdentifier
    path: $path
    fileHandle: $fileHandle
    formDefinitionIdentifier: $formDefinitionIdentifier
  ) {
    id
    __typename
  }
}
""".strip()

SUBMIT_MUTATION = """
mutation ApiSubmitMultipleFormsAction(
  $organizationHostedJobsPageName: String!,
  $jobPostingId: String!,
  $applicationFormRenderIdentifier: String!,
  $applicationFormActionIdentifier: String!,
  $applicationFormDefinitionIdentifier: String,
  $surveyIdentifiers: [JSON!]!,
  $recaptchaToken: String!,
  $sourceAttributionCode: String,
  $viewedAutomatedProcessingLegalNoticeRuleId: String,
  $deviceFingerprint: String,
  $applicationRequestId: String
) {
  submitMultipleFormsAction(
    organizationHostedJobsPageName: $organizationHostedJobsPageName
    jobPostingId: $jobPostingId
    applicationFormRenderIdentifier: $applicationFormRenderIdentifier
    applicationFormActionIdentifier: $applicationFormActionIdentifier
    applicationFormDefinitionIdentifier: $applicationFormDefinitionIdentifier
    surveyIdentifiers: $surveyIdentifiers
    recaptchaToken: $recaptchaToken
    sourceAttributionCode: $sourceAttributionCode
    viewedAutomatedProcessingLegalNoticeRuleId: $viewedAutomatedProcessingLegalNoticeRuleId
    deviceFingerprint: $deviceFingerprint
    applicationRequestId: $applicationRequestId
  ) {
    applicationFormResult {
      __typename
      ... on FormSubmitSuccess { _ }
      ... on FormRender { id errorMessages __typename }
    }
    surveyFormResults { __typename }
    messages { blockMessageForCandidateHtml __typename }
    __typename
  }
}
""".strip()


class AshbyClient:
    def __init__(self) -> None:
        self.session = requests.Session()

    def gql(self, op: str, query: str, variables: dict[str, Any]) -> dict[str, Any]:
        response = self.session.post(
            f"https://jobs.ashbyhq.com/api/non-user-graphql?op={op}",
            json={"operationName": op, "variables": variables, "query": query},
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        if data.get("errors"):
            raise RuntimeError(json.dumps(data["errors"], indent=2))
        return data

    def fetch_job_posting(self, slug: str, job_id: str) -> dict[str, Any]:
        return self.gql(
            "ApiJobPosting",
            JOB_QUERY,
            {
                "organizationHostedJobsPageName": slug,
                "jobPostingId": job_id,
            },
        )["data"]["jobPosting"]

    def create_upload_handle(
        self, slug: str, filename: str, content_type: str, content_length: int
    ) -> dict[str, Any]:
        return self.gql(
            "ApiCreateFileUploadHandle",
            CREATE_UPLOAD_HANDLE_MUTATION,
            {
                "organizationHostedJobsPageName": slug,
                "fileUploadContext": "NonUserFormEngine",
                "filename": filename,
                "contentType": content_type,
                "contentLength": content_length,
            },
        )["data"]["fileUploadHandle"]

    def upload_file(self, handle_info: dict[str, Any], path: Path, content_type: str) -> None:
        files = {"file": (path.name, path.read_bytes(), content_type)}
        fields = dict(handle_info["fields"])
        fields.setdefault("Content-Type", content_type)
        response = self.session.post(handle_info["url"], data=fields, files=files, timeout=60)
        response.raise_for_status()

    def set_form_value(
        self,
        slug: str,
        form_render_id: str,
        form_definition_id: str,
        path: str,
        value: Any,
    ) -> dict[str, Any]:
        return self.gql(
            "ApiSetFormValue",
            SET_FORM_VALUE_MUTATION,
            {
                "organizationHostedJobsPageName": slug,
                "formRenderIdentifier": form_render_id,
                "path": path,
                "value": value,
                "formDefinitionIdentifier": form_definition_id,
            },
        )

    def set_form_value_to_file(
        self,
        slug: str,
        form_render_id: str,
        form_definition_id: str,
        path: str,
        file_handle: str,
    ) -> dict[str, Any]:
        return self.gql(
            "ApiSetFormValueToFile",
            SET_FORM_VALUE_TO_FILE_MUTATION,
            {
                "organizationHostedJobsPageName": slug,
                "formRenderIdentifier": form_render_id,
                "path": path,
                "fileHandle": file_handle,
                "formDefinitionIdentifier": form_definition_id,
            },
        )

    def submit_multiple_forms(
        self,
        slug: str,
        job_posting_id: str,
        application_form: dict[str, Any],
        survey_forms: list[dict[str, Any]],
        recaptcha_token: str,
        source_attribution_code: str | None,
        viewed_notice_rule_id: str | None,
        device_fingerprint: str | None,
        application_request_id: str | None,
    ) -> dict[str, Any]:
        survey_identifiers = [
            {
                "formRenderId": survey["id"],
                "actionIdentifier": survey["formControls"][0]["identifier"],
                "sourceFormDefinitionId": survey["sourceFormDefinitionId"],
            }
            for survey in survey_forms
            if survey.get("formControls")
        ]
        return self.gql(
            "ApiSubmitMultipleFormsAction",
            SUBMIT_MUTATION,
            {
                "organizationHostedJobsPageName": slug,
                "jobPostingId": job_posting_id,
                "applicationFormRenderIdentifier": application_form["id"],
                "applicationFormActionIdentifier": application_form["formControls"][0]["identifier"],
                "applicationFormDefinitionIdentifier": application_form["sourceFormDefinitionId"],
                "surveyIdentifiers": survey_identifiers,
                "recaptchaToken": recaptcha_token,
                "sourceAttributionCode": source_attribution_code,
                "viewedAutomatedProcessingLegalNoticeRuleId": viewed_notice_rule_id,
                "deviceFingerprint": device_fingerprint,
                "applicationRequestId": application_request_id,
            },
        )


def normalize_fields(field_entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    items = []
    for entry in field_entries:
        field = entry["field"]
        items.append(
            {
                "entryId": entry["id"],
                "required": entry["isRequired"],
                "hidden": entry["isHidden"],
                "path": field["path"],
                "title": field["title"],
                "type": field["type"],
                "selectableValues": field.get("selectableValues"),
            }
        )
    return items


def describe_command(args: argparse.Namespace) -> int:
    client = AshbyClient()
    posting = client.fetch_job_posting(args.slug, args.job_id)
    result = {
        "jobPostingId": posting["id"],
        "title": posting["title"],
        "locationName": posting["locationName"],
        "departmentName": posting["departmentName"],
        "applicationForm": {
            "id": posting["applicationForm"]["id"],
            "sourceFormDefinitionId": posting["applicationForm"]["sourceFormDefinitionId"],
            "formControls": posting["applicationForm"]["formControls"],
            "sections": [
                {
                    "title": section["title"],
                    "fields": normalize_fields(section["fieldEntries"]),
                }
                for section in posting["applicationForm"]["sections"]
            ],
        },
        "surveyForms": [
            {
                "id": survey["id"],
                "sourceFormDefinitionId": survey["sourceFormDefinitionId"],
                "formControls": survey["formControls"],
                "sections": [
                    {
                        "title": section["title"],
                        "fields": normalize_fields(section["fieldEntries"]),
                    }
                    for section in survey["sections"]
                ],
            }
            for survey in posting["surveyForms"]
        ],
    }
    print(json.dumps(result, indent=2))
    return 0


def parse_path_assignments(items: list[str], *, json_values: bool = False) -> dict[str, Any]:
    parsed: dict[str, Any] = {}
    for item in items:
        if "=" not in item:
            raise ValueError(f"Expected PATH=VALUE, got: {item}")
        path, raw_value = item.split("=", 1)
        parsed[path] = json.loads(raw_value) if json_values else raw_value
    return parsed


def parse_survey_assignments(items: list[str], *, json_values: bool = False) -> dict[int, dict[str, Any]]:
    parsed: dict[int, dict[str, Any]] = {}
    for item in items:
        if ":" not in item or "=" not in item:
            raise ValueError(f"Expected INDEX:PATH=VALUE, got: {item}")
        form_idx_raw, remainder = item.split(":", 1)
        path, raw_value = remainder.split("=", 1)
        form_idx = int(form_idx_raw)
        parsed.setdefault(form_idx, {})[path] = json.loads(raw_value) if json_values else raw_value
    return parsed


def content_type_for(path: Path) -> str:
    return mimetypes.guess_type(path.name)[0] or "application/octet-stream"


def set_file_field(
    client: AshbyClient,
    slug: str,
    form_render_id: str,
    form_definition_id: str,
    path: str,
    file_path: Path,
) -> None:
    handle = client.create_upload_handle(
        slug=slug,
        filename=file_path.name,
        content_type=content_type_for(file_path),
        content_length=file_path.stat().st_size,
    )
    client.upload_file(handle, file_path, content_type_for(file_path))
    client.set_form_value_to_file(
        slug=slug,
        form_render_id=form_render_id,
        form_definition_id=form_definition_id,
        path=path,
        file_handle=handle["handle"],
    )


def submit_command(args: argparse.Namespace) -> int:
    client = AshbyClient()
    posting = client.fetch_job_posting(args.slug, args.job_id)
    application_form = posting["applicationForm"]
    survey_forms = posting["surveyForms"]

    set_file_field(
        client,
        slug=args.slug,
        form_render_id=application_form["id"],
        form_definition_id=application_form["sourceFormDefinitionId"],
        path="_systemfield_resume",
        file_path=Path(args.resume).expanduser().resolve(),
    )

    client.set_form_value(
        args.slug,
        application_form["id"],
        application_form["sourceFormDefinitionId"],
        "_systemfield_name",
        args.name,
    )
    client.set_form_value(
        args.slug,
        application_form["id"],
        application_form["sourceFormDefinitionId"],
        "_systemfield_email",
        args.email,
    )

    app_fields = parse_path_assignments(args.field)
    app_fields.update(parse_path_assignments(args.json_field, json_values=True))
    for path, value in app_fields.items():
        client.set_form_value(
            args.slug,
            application_form["id"],
            application_form["sourceFormDefinitionId"],
            path,
            value,
        )

    survey_fields = parse_survey_assignments(args.survey_field)
    survey_json_fields = parse_survey_assignments(args.survey_json_field, json_values=True)
    for idx, values in survey_json_fields.items():
        survey_fields.setdefault(idx, {}).update(values)

    for idx, values in survey_fields.items():
        survey = survey_forms[idx]
        for path, value in values.items():
            client.set_form_value(
                args.slug,
                survey["id"],
                survey["sourceFormDefinitionId"],
                path,
                value,
            )

    for item in args.file_field:
        if "=" not in item:
            raise ValueError(f"Expected PATH=/absolute/file, got: {item}")
        path, raw_file = item.split("=", 1)
        set_file_field(
            client,
            slug=args.slug,
            form_render_id=application_form["id"],
            form_definition_id=application_form["sourceFormDefinitionId"],
            path=path,
            file_path=Path(raw_file).expanduser().resolve(),
        )

    if args.dry_run:
        print(
            json.dumps(
                {
                    "status": "dry-run-complete",
                    "jobPostingId": posting["id"],
                    "title": posting["title"],
                    "applicationFormId": application_form["id"],
                    "surveyFormIds": [survey["id"] for survey in survey_forms],
                },
                indent=2,
            )
        )
        return 0

    result = client.submit_multiple_forms(
        slug=args.slug,
        job_posting_id=args.job_id,
        application_form=application_form,
        survey_forms=survey_forms,
        recaptcha_token=args.recaptcha_token,
        source_attribution_code=args.source_attribution_code,
        viewed_notice_rule_id=args.viewed_automated_processing_legal_notice_rule_id,
        device_fingerprint=args.device_fingerprint,
        application_request_id=args.application_request_id,
    )
    print(json.dumps(result, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Inspect and replay public Ashby job application APIs.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    describe = subparsers.add_parser("describe", help="Print form paths for a public Ashby role.")
    describe.add_argument("--slug", required=True, help="Ashby hosted jobs page slug, e.g. picogrid")
    describe.add_argument("--job-id", required=True, help="Ashby job posting UUID")
    describe.set_defaults(func=describe_command)

    submit = subparsers.add_parser("submit", help="Replay a public Ashby application submit.")
    submit.add_argument("--slug", required=True)
    submit.add_argument("--job-id", required=True)
    submit.add_argument("--resume", required=True, help="Path to resume file to upload")
    submit.add_argument("--name", required=True)
    submit.add_argument("--email", required=True)
    submit.add_argument("--recaptcha-token", required=True, help="Browser-minted token from the target application page")
    submit.add_argument("--field", action="append", default=[], help="Application PATH=VALUE")
    submit.add_argument("--json-field", action="append", default=[], help="Application PATH=<json>")
    submit.add_argument("--file-field", action="append", default=[], help="Application PATH=/absolute/file")
    submit.add_argument("--survey-field", action="append", default=[], help="Survey INDEX:PATH=VALUE")
    submit.add_argument("--survey-json-field", action="append", default=[], help="Survey INDEX:PATH=<json>")
    submit.add_argument("--source-attribution-code")
    submit.add_argument("--device-fingerprint")
    submit.add_argument("--application-request-id")
    submit.add_argument("--viewed-automated-processing-legal-notice-rule-id")
    submit.add_argument("--dry-run", action="store_true", help="Stop after uploads and field saves")
    submit.set_defaults(func=submit_command)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
