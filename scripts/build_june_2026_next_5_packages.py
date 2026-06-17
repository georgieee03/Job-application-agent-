#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = ROOT / "data" / "june-2026-next-5"
REFERENCE = Path(r"F:\Resume tracker\George_Jobi_Resume_Kforce.pdf")
BUILDER_PATH = ROOT / "scripts" / "build_next_ten_resume_packages.py"
VALIDATOR = (
    ROOT
    / ".agents"
    / "skills"
    / "tailor-job-resume"
    / "scripts"
    / "validate_resume.py"
)
MANIFEST_BUILDER = (
    ROOT
    / ".agents"
    / "skills"
    / "tailor-job-resume"
    / "scripts"
    / "build_package_manifest.py"
)


def load_builder() -> Any:
    spec = importlib.util.spec_from_file_location("preserved_resume_builder", BUILDER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load resume builder: {BUILDER_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.OUT_ROOT = OUT_ROOT
    return module


COMMON_CONFIRM = [
    "Current U.S. work authorization: Yes, through OPT eligibility.",
    "Future employment sponsorship required: Yes.",
    "Earliest start date: two weeks.",
    "Willing to relocate anywhere in the United States.",
    "No cover letter is required or materially useful for this application.",
]


ROLES: list[dict[str, Any]] = [
    {
        "folder": "corvus-product-implementation-engineer",
        "company": "Corvus Robotics",
        "role": "Product Implementation Engineer I, II",
        "location": "US Remote; Mountain View, CA",
        "url": "https://jobs.ashbyhq.com/corvus-robotics/e180a9e8-6611-485b-b76a-bbf995b69e7f/application",
        "listingUrl": "https://jobs.ashbyhq.com/corvus-robotics/e180a9e8-6611-485b-b76a-bbf995b69e7f",
        "summary": (
            "Robotics Implementation Engineer pursuing an M.S. in Robotics and "
            "Autonomous Systems (AI) at Arizona State University, with a B.S. in "
            "Computer Science. Hands-on experience operating and validating physical "
            "robots, integrating sensors and controls, diagnosing hardware-software "
            "issues, and building robotics workflows with Python, C/C++, Linux/Ubuntu, "
            "ROS/ROS 2 concepts, shell scripting, Git, SQL, logging, and structured "
            "testing. Strong communicator with production software experience and a "
            "practical focus on reliable field deployment and incident response."
        ),
        "skills_add": (
            "Role Emphasis: Robotics Implementation, Autonomous Robot Operations, "
            "Customer-Site Deployment, Ubuntu, ROS, Python, Shell Scripting, Git, SQL, "
            "Incident Response, Hardware-Software Troubleshooting, Electrical Diagnosis "
            "Concepts, Mechanical Repair Concepts, Data Logging, Implementation Projects"
        ),
        "project_edits": {
            1: (
                "Emphasized physical robot operation, sensor logging, safety checks, "
                "failsafes, and hands-on hardware-software troubleshooting."
            ),
            4: (
                "Emphasized upcoming industrial automation integration, sensors, "
                "actuators, control logic, and deployment-oriented documentation."
            ),
        },
        "keywords": [
            "robotics implementation",
            "autonomous robot operations",
            "customer-site deployment",
            "Ubuntu",
            "ROS",
            "Python",
            "shell scripting",
            "Git",
            "SQL",
            "incident response",
            "hardware-software troubleshooting",
            "electrical diagnosis",
            "mechanical repair",
            "data logging",
            "implementation projects",
        ],
        "gap": (
            "Direct warehouse-drone deployment, professional electrical diagnosis, and "
            "mechanical repair ownership are not verified. The resume labels repair and "
            "diagnosis depth as concepts and emphasizes verified physical robot testing, "
            "sensor/control integration, logging, safety checks, Linux, Python, Git, SQL, "
            "and production troubleshooting."
        ),
        "description": [
            "Install and configure Corvus One autonomous-drone hardware at customer facilities.",
            "Organize implementation projects and perform incident response for real-world robotics operations.",
            "Use Ubuntu, ROS, Python, shell scripts, Git, and SQL.",
            "Conduct electrical diagnosis and mechanical repair on hardware devices.",
            "Travel about 80% and be able to rent and drive cars in the United States.",
            "Recent graduates and international students are encouraged to apply.",
        ],
        "confirm": [
            *COMMON_CONFIRM,
            "Valid U.S. driver license, legal driving/rental eligibility, and 80% travel willingness require user confirmation.",
        ],
    },
    {
        "folder": "arxlight-newgrad-engineering",
        "company": "Arxlight",
        "role": "Newgrad Engineering Role (Various)",
        "location": "Oakland, CA - On-site",
        "url": "https://jobs.ashbyhq.com/arxlight-ai/ca17abfe-c253-4cc8-95ec-027a471ac734/application",
        "listingUrl": "https://jobs.ashbyhq.com/arxlight-ai/ca17abfe-c253-4cc8-95ec-027a471ac734",
        "summary": (
            "New-Grad Robotics and Autonomous Systems Engineer pursuing an M.S. in "
            "Robotics and Autonomous Systems (AI) at Arizona State University, with a "
            "B.S. in Computer Science. Hands-on experience with UAV-style physical robot "
            "control, autonomous systems, field testing, sensor fusion, data logging, "
            "performance analysis, safety checks, C/C++, Python, Linux, ROS/Gazebo "
            "concepts, computer vision, and multidisciplinary hardware-software "
            "integration. Built and evaluated real and simulated autonomy systems with "
            "strong ownership, rapid iteration, and structured validation."
        ),
        "skills_add": (
            "Role Emphasis: New-Grad Engineering, UAV Systems, Autonomous Systems, "
            "Field Testing, Data Logging, Performance Analysis, Hardware-Software "
            "Integration, Multidisciplinary Engineering, Physical Robot Validation, "
            "C++, Python, Linux, Safety-Critical Systems Concepts"
        ),
        "project_edits": {
            1: (
                "Emphasized UAV-style physical robot control, field testing, sensor "
                "logging, performance analysis, safety checks, and rapid iteration."
            ),
            3: (
                "Emphasized multidisciplinary mechanical, actuator, kinematics, and "
                "software-integration work for a real-world robot design."
            ),
        },
        "keywords": [
            "new-grad engineering",
            "UAV systems",
            "autonomous systems",
            "field testing",
            "data logging",
            "performance analysis",
            "hardware-software integration",
            "multidisciplinary engineering",
            "physical robot validation",
            "C++",
            "Python",
            "Linux",
            "safety-critical systems",
        ],
        "gap": (
            "Professional UAV product development and defense/security deployment are not "
            "verified. The package foregrounds truthful physical aerial-robot control, "
            "sensor fusion, field-style testing, logging, safety checks, computer vision, "
            "and hardware-software integration without claiming export-controlled work."
        ),
        "description": [
            "Build next-generation drone hardware and software for security and safety applications.",
            "Bachelor's degree or higher in engineering or a related field.",
            "Work effectively in a multidisciplinary engineering team with limited guidance.",
            "Preferred experience with UAVs, UGVs, mobile robots, or manipulators.",
            "Preferred experience with field testing, data logging, and performance analysis.",
            "Work on-site at the Bay Area headquarters five days per week.",
        ],
        "confirm": [
            *COMMON_CONFIRM,
            "F-1 student visa is an explicit export-control form option.",
            "Exact GPA and scale require user confirmation.",
        ],
    },
    {
        "folder": "fieldai-robotics-software-mapping",
        "company": "FieldAI",
        "role": "Robotics Software Engineer, Mapping",
        "location": "Irvine, CA - On-site",
        "url": "https://jobs.lever.co/field-ai/92149b57-93b7-4d02-8747-0413718ab81e/apply",
        "listingUrl": "https://jobs.lever.co/field-ai/92149b57-93b7-4d02-8747-0413718ab81e",
        "summary": (
            "Robotics Mapping and Perception Engineer pursuing an M.S. in Robotics and "
            "Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer "
            "Science. Research experience building camera-LiDAR perception, point-cloud "
            "processing, depth estimation, mapping, localization, pose estimation, sensor "
            "fusion, and real-robot validation workflows using C/C++, Python, PyTorch, "
            "OpenCV, CARLA, Gazebo, ROS/ROS 2 concepts, and expert Linux/Ubuntu. Strong "
            "software foundation in testing, documentation, performance analysis, and "
            "production-minded data pipelines."
        ),
        "skills_add": (
            "Role Emphasis: 3D Mapping, Point Cloud Processing, Scan Alignment Concepts, "
            "Noise Reduction, Segmentation, Object Detection, 3D Geometry, Robot "
            "Kinematics, ICP Concepts, NDT Concepts, PCL Concepts, Open3D Concepts, "
            "CloudCompare Concepts, LiDAR, PCD/PLY/E57/LAS Concepts, C++, Python, ROS, Ubuntu"
        ),
        "project_edits": {
            0: (
                "Emphasized camera-LiDAR point-cloud processing, segmentation, depth, "
                "pose estimation, mapping, localization, dataset pipelines, and "
                "performance validation."
            ),
            2: (
                "Emphasized 3D geometry, robot kinematics, mapping-adjacent path planning, "
                "Gazebo simulation, and repeatable validation."
            ),
        },
        "keywords": [
            "3D mapping",
            "point cloud processing",
            "scan alignment",
            "noise reduction",
            "segmentation",
            "object detection",
            "3D geometry",
            "robot kinematics",
            "ICP",
            "NDT",
            "PCL",
            "Open3D",
            "CloudCompare",
            "LiDAR",
            "PCD",
            "PLY",
            "E57",
            "LAS",
            "C++",
            "Python",
            "ROS",
            "Ubuntu",
        ],
        "gap": (
            "Direct hands-on ownership of PCL, Open3D, CloudCompare, ICP, NDT, and survey "
            "data formats is not verified. These are labeled as concepts while the resume "
            "emphasizes verified camera-LiDAR point-cloud work, 3D perception, mapping, "
            "localization, pose estimation, C++/Python, ROS/Gazebo, and Linux."
        ),
        "description": [
            "Develop point-cloud processing pipelines for alignment, noise reduction, segmentation, and detection.",
            "Implement mapping and perception algorithms in C++ and Python.",
            "Use 3D geometry, robot kinematics, ICP/NDT, PCL, Open3D, CloudCompare, ROS, and Ubuntu.",
            "Integrate LiDAR systems and work with PCD, PLY, E57, and LAS data.",
            "Validate algorithms on real robots in real-world environments.",
            "Master's degree or Ph.D. in a related field is requested.",
        ],
        "confirm": [
            *COMMON_CONFIRM,
            "At-least-18 and legal-duty certification requires user confirmation.",
        ],
    },
    {
        "folder": "fieldai-robotics-qa-qc-engineer",
        "company": "FieldAI",
        "role": "Robotics QA / QC Engineer",
        "location": "Irvine, CA - On-site",
        "url": "https://jobs.lever.co/field-ai/8df764f7-7451-4813-a4f3-69277b9fef76/apply",
        "listingUrl": "https://jobs.lever.co/field-ai/8df764f7-7451-4813-a4f3-69277b9fef76",
        "summary": (
            "Robotics QA and Validation Engineer pursuing an M.S. in Robotics and "
            "Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer "
            "Science. Hands-on experience testing physical robots, monitoring sensor and "
            "control behavior, capturing structured logs, reproducing failures, validating "
            "fixes, and building repeatable Python/Linux test workflows. Background spans "
            "cameras, LiDAR, inertial sensing, PID control, safety checks, regression-minded "
            "evaluation, computer vision, autonomy simulation, production debugging, and "
            "clear technical documentation."
        ),
        "skills_add": (
            "Role Emphasis: Robotics QA/QC, Manual Testing, Structured Testing, Physical "
            "Robot Validation, System Monitoring, Bug Reproduction, Edge Cases, Test Logs, "
            "Regression Testing, QA Processes, Test Procedures, Operational Checklists, "
            "Python, Bash, Cameras, LiDAR, GPS Concepts, Safety-Conscious Testing"
        ),
        "project_edits": {
            1: (
                "Emphasized automated and manual test sequences, system monitoring, sensor "
                "logs, bug reproduction, safety checks, failsafes, and regression-minded "
                "physical robot validation."
            ),
            0: (
                "Emphasized structured model evaluation, failure diagnosis, dataset-based "
                "testing, reproducibility, and verification of performance improvements."
            ),
        },
        "keywords": [
            "robotics QA/QC",
            "manual testing",
            "structured testing",
            "physical robot validation",
            "system monitoring",
            "bug reproduction",
            "edge cases",
            "test logs",
            "regression testing",
            "QA processes",
            "test procedures",
            "operational checklists",
            "Python",
            "Bash",
            "cameras",
            "LiDAR",
            "GPS",
            "safety-conscious testing",
        ],
        "gap": (
            "Two years of professional QA ownership and formal Jira-based robotics QA are "
            "not verified. The role explicitly welcomes strong entry-level candidates with "
            "relevant projects, and the resume emphasizes verified physical robot testing, "
            "logging, failure diagnosis, safety checks, Python, Linux, sensors, and "
            "production software debugging."
        ),
        "description": [
            "Execute manual and structured tests of robotic systems in controlled environments.",
            "Monitor behavior, document bugs and edge cases, capture logs, and validate fixes.",
            "Improve QA processes, regression testing, test procedures, and operational checklists.",
            "Use basic Python or Bash for test support and data collection.",
            "Work with cameras, LiDAR, GPS, and other robotic sensor systems.",
            "Open to strong entry-level candidates with relevant experience or projects.",
        ],
        "confirm": [
            *COMMON_CONFIRM,
            "At-least-18 and legal-duty certification requires user confirmation.",
        ],
    },
    {
        "folder": "humble-software-engineer-autonomous-systems",
        "company": "Humble Robotics",
        "role": "Software Engineer, Autonomous Systems",
        "location": "San Francisco, CA - On-site",
        "url": "https://jobs.lever.co/humble-robotics/910e6e24-e644-42d8-aa08-18e87d535cbd/apply",
        "listingUrl": "https://jobs.lever.co/humble-robotics/910e6e24-e644-42d8-aa08-18e87d535cbd",
        "summary": (
            "Autonomous Systems Software Engineer pursuing an M.S. in Robotics and "
            "Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer "
            "Science. Hands-on experience integrating sensors, perception, controls, data "
            "logging, model inference, performance profiling, tests, CI/CD, and Linux-based "
            "robotics software using modern C/C++, Python, PyTorch, CARLA, Gazebo, Docker, "
            "Git, and hardware-adjacent validation. Production internship experience "
            "includes high-throughput data pipelines, latency optimization, backend "
            "services, debugging, and reliable deployment workflows."
        ),
        "skills_add": (
            "Role Emphasis: Autonomous Systems Software, On-Vehicle Software Concepts, "
            "Real-Time Systems Concepts, Low-Latency Software, Concurrent Software "
            "Concepts, Linux Systems, Sensor Integration, Data Logging, Compute Throughput, "
            "Disk I/O Concepts, IPC Concepts, Synchronization Primitives Concepts, CI, "
            "Cross-Compilation Concepts, Packaging, Deployment, C++, Python"
        ),
        "project_edits": {
            1: (
                "Emphasized Linux-based physical robot control, sensor integration, "
                "on-device logging, real-time behavior, safety, and performance evaluation."
            ),
            0: (
                "Emphasized GPU-accelerated inference/training, system performance, "
                "high-throughput data pipelines, latency debugging, and model integration."
            ),
        },
        "keywords": [
            "autonomous systems software",
            "on-vehicle software",
            "real-time systems",
            "low-latency software",
            "concurrent software",
            "Linux systems",
            "sensor integration",
            "data logging",
            "compute throughput",
            "disk I/O",
            "IPC",
            "synchronization primitives",
            "CI",
            "cross-compilation",
            "packaging",
            "deployment",
            "C++",
            "Python",
        ],
        "gap": (
            "Shipping low-latency concurrent systems, Rust, real-time scheduling, IPC, "
            "shared-memory transport, hermetic builds, and cross-compilation are not "
            "verified as production ownership. The package labels these as concepts and "
            "emphasizes verified C++/Python, Linux robotics, sensor integration, logging, "
            "latency optimization, CI/CD, Docker, model pipelines, and physical robot tests."
        ),
        "description": [
            "Build real-time autonomy software that runs on an autonomous freight vehicle.",
            "Improve on-vehicle logging, recording, packaging, deployment, tests, and CI.",
            "Profile IPC latency, compute throughput, and disk I/O.",
            "Integrate sensors, ML inference, controls, cloud, and fleet-facing systems.",
            "Strong Rust or C++ and low-latency concurrent Linux experience are requested.",
            "Experience with autonomous vehicles, mobile robots, sensor integration, and production AI is preferred.",
        ],
        "confirm": [
            *COMMON_CONFIRM,
            "The application uses hCaptcha and may require manual human verification.",
        ],
    },
]


def write_role_files(role: dict[str, Any], folder: Path) -> None:
    (folder / "ats-keywords.txt").write_text(
        "\n".join(role["keywords"]) + "\n", encoding="utf-8"
    )
    description = [
        f"# {role['company']} - {role['role']}",
        "",
        f"- Location: {role['location']}",
        f"- Authoritative listing: {role['listingUrl']}",
        f"- Application: {role['url']}",
        "- Live listing/form verified: June 9, 2026",
        "",
        "## Core Requirements",
        "",
        *[f"- {item}" for item in role["description"]],
        "",
    ]
    (folder / "job-description.md").write_text(
        "\n".join(description), encoding="utf-8"
    )
    analysis = [
        f"# {role['company']} - {role['role']}",
        "",
        "## Keyword Gap Analysis",
        "",
        role["gap"],
        "",
        "## Package Notes",
        "",
        "- All verified education, projects, experience, dates, and metrics are preserved.",
        "- Role emphasis changes wording and ordering without inventing experience.",
        "- ATS alignment is a local phrase-coverage heuristic, not an employer ATS result.",
        "",
        "## Confirmed Or Manual-Check Answers",
        "",
        *[f"- {item}" for item in role["confirm"]],
        "",
    ]
    (folder / "package-analysis.md").write_text(
        "\n".join(analysis), encoding="utf-8"
    )


def run_checked(command: list[str]) -> None:
    completed = subprocess.run(command, cwd=ROOT, text=True, capture_output=True)
    if completed.returncode != 0:
        raise RuntimeError(
            f"Command failed ({completed.returncode}): {' '.join(command)}\n"
            f"{completed.stdout}\n{completed.stderr}"
        )


def build_approval_preview(
    company: str, role: str, preview_paths: list[Path], out: Path
) -> None:
    pages = [Image.open(path).convert("RGB") for path in preview_paths]
    gap = 24
    header = 74
    width = sum(page.width for page in pages) + gap * (len(pages) - 1)
    height = header + max(page.height for page in pages)
    canvas = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(canvas)
    draw.text((12, 10), f"{company} - {role}", fill="black")
    draw.text((12, 38), "George_Jobi_Resume.pdf - Page 1 and Page 2", fill="black")
    x = 0
    for page in pages:
        canvas.paste(page, (x, header))
        x += page.width + gap
    canvas.save(out)
    for page in pages:
        page.close()


def main() -> int:
    builder = load_builder()
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    reference_pages = builder.render_png(REFERENCE, "reference-kforce")
    summary: list[dict[str, Any]] = []

    for role in ROLES:
        resume = builder.render_resume(role)
        folder = resume.parent
        write_role_files(role, folder)
        previews = builder.render_png(resume, "resume-preview")
        approval_preview = folder / "approval-preview.png"
        build_approval_preview(role["company"], role["role"], previews, approval_preview)
        comparison = folder / "format-comparison-page-1.png"
        builder.compare(reference_pages[0], previews[0], comparison)

        validation = folder / "validation-report.json"
        run_checked(
            [
                sys.executable,
                str(VALIDATOR),
                "--pdf",
                str(resume),
                "--keywords",
                str(folder / "ats-keywords.txt"),
                "--reference",
                str(REFERENCE),
                "--json-out",
                str(validation),
            ]
        )
        manifest = folder / "approval-manifest.json"
        run_checked(
            [
                sys.executable,
                str(MANIFEST_BUILDER),
                "--company",
                role["company"],
                "--role",
                role["role"],
                "--job-url",
                role["listingUrl"],
                "--resume",
                str(resume),
                "--validation",
                str(validation),
                "--out",
                str(manifest),
            ]
        )
        report = json.loads(validation.read_text(encoding="utf-8"))
        summary.append(
            {
                "folder": role["folder"],
                "company": role["company"],
                "role": role["role"],
                "location": role["location"],
                "listingUrl": role["listingUrl"],
                "applicationUrl": role["url"],
                "resume": str(resume),
                "previewPages": [str(path) for path in previews],
                "approvalPreview": str(approval_preview),
                "formatComparison": str(comparison),
                "analysis": str(folder / "package-analysis.md"),
                "validation": str(validation),
                "approvalManifest": str(manifest),
                "ats": report["keywordCoverage"],
                "pageFillRatios": report["pageFillRatios"],
                "confirm": role["confirm"],
            }
        )

    (OUT_ROOT / "package-summary.json").write_text(
        json.dumps(summary, indent=2) + "\n", encoding="utf-8"
    )
    checklist = [
        "# June 2026 Next Five Application Approval Checklist",
        "",
        "Standing authorization applies only to packages that pass deterministic validation.",
        "",
    ]
    for item in summary:
        manifest = json.loads(Path(item["approvalManifest"]).read_text(encoding="utf-8"))
        checklist.extend(
            [
                f"## {item['company']} - {item['role']}",
                "",
                f"- Resume: `{item['resume']}`",
                f"- SHA-256: `{manifest['files']['resume']['sha256']}`",
                (
                    "- Estimated ATS alignment: "
                    f"{item['ats']['estimatedAtsAlignment']}% (local heuristic)"
                ),
                f"- Page fill: {item['pageFillRatios']['values']}",
                "- [x] Existing verified content is preserved.",
                "- [x] Skills and claims are truthfully qualified.",
                "- [x] Formatting and structural validation passed.",
                "- [x] Exact filename is `George_Jobi_Resume.pdf`.",
                "",
            ]
        )
    (OUT_ROOT / "approval-checklist.md").write_text(
        "\n".join(checklist) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
