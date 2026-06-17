#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  job_board_fetch.sh greenhouse <board_token>
  job_board_fetch.sh lever <company_slug>
  job_board_fetch.sh ashby <hosted_jobs_page_name>

Examples:
  job_board_fetch.sh greenhouse gleanwork
  job_board_fetch.sh lever sysdig
  job_board_fetch.sh ashby openai
EOF
}

if [[ $# -ne 2 ]]; then
  usage
  exit 1
fi

provider="$1"
target="$2"

case "$provider" in
  greenhouse)
    curl -fsS "https://boards-api.greenhouse.io/v1/boards/${target}/jobs?content=true"
    ;;
  lever)
    curl -fsS "https://api.lever.co/v0/postings/${target}?mode=json"
    ;;
  ashby)
    curl -fsS "https://jobs.ashbyhq.com/api/non-user-graphql?op=jobBoardWithTeams" \
      -H "content-type: application/json" \
      --data "{\"operationName\":\"jobBoardWithTeams\",\"variables\":{\"organizationHostedJobsPageName\":\"${target}\"},\"query\":\"query jobBoardWithTeams(\$organizationHostedJobsPageName: String!) { jobBoardWithTeams(organizationHostedJobsPageName: \$organizationHostedJobsPageName) { teams { id name parentTeamId } jobPostings { id title teamId locationName locationId employmentType secondaryLocations { locationName } } } }\"}"
    ;;
  *)
    usage
    exit 1
    ;;
esac
