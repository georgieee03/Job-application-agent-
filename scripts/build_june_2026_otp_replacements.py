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
BASE_SCRIPT = ROOT / "scripts" / "build_june_2026_next_5_packages.py"
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


def load_base() -> Any:
    spec = importlib.util.spec_from_file_location("next_five_builder", BASE_SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load package builder: {BASE_SCRIPT}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


ROLES: list[dict[str, Any]] = [
    {
        "folder": "circuithub-full-stack-robotics-engineer",
        "company": "CircuitHub",
        "role": "Full-Stack Robotics Engineer",
        "location": "South Deerfield, MA - On-site",
        "listingUrl": (
            "https://jobs.ashbyhq.com/circuithub/"
            "6ce5e5f2-7dd4-4c5c-8978-ab6f3e2e1e1d"
        ),
        "url": (
            "https://jobs.ashbyhq.com/circuithub/"
            "6ce5e5f2-7dd4-4c5c-8978-ab6f3e2e1e1d/application"
        ),
        "summary": (
            "Full-Stack Robotics Engineer pursuing an M.S. in Robotics and Autonomous "
            "Systems (AI) at Arizona State University, with a B.S. in Computer "
            "Science. Hands-on experience building complete robotics workflows across "
            "physical robot control, sensors, perception, motion planning, simulation, "
            "backend services, testing, logging, and hardware-software debugging using "
            "Python, C/C++, Linux, ROS/ROS 2 concepts, Gazebo, CARLA, OpenCV, Docker, "
            "SQL, and CAD/URDF concepts. Strong production software background with a "
            "practical focus on system reliability, performance, and rapid iteration."
        ),
        "skills_add": (
            "Role Emphasis: Full-Stack Robotics, Factory Automation, Python Control "
            "Software, C++, Mechanical CAD, Basic Electronics, Industrial PLC Concepts, "
            "Vision Systems, GigE Vision Concepts, Industrial Sensors, Motion Control, "
            "Hardware-Software Debugging, Production Reliability, System Uptime"
        ),
        "project_edits": {
            1: (
                "Emphasized complete physical robot integration across sensors, control "
                "software, logging, safety checks, debugging, and repeatable testing."
            ),
            3: (
                "Emphasized mechanical CAD, constrained joints, actuator placement, "
                "kinematics, and URDF-ready robot design."
            ),
            4: (
                "Emphasized factory automation, sensors, actuators, PLC/control-logic "
                "concepts, and documented hardware-software integration."
            ),
        },
        "keywords": [
            "full-stack robotics",
            "factory automation",
            "Python",
            "C++",
            "mechanical CAD",
            "electronics",
            "PLC",
            "vision systems",
            "GigE Vision",
            "industrial sensors",
            "motion control",
            "hardware software debugging",
            "production reliability",
            "system uptime",
        ],
        "gap": (
            "Professional Beckhoff TwinCAT, GigE Vision, and live electronics-factory "
            "uptime ownership are not verified. The role explicitly welcomes an "
            "early-career engineer with full robotic-system projects, and the package "
            "truthfully emphasizes physical robot control, sensor integration, Python "
            "and C++, CAD, automation concepts, testing, debugging, and production "
            "software experience."
        ),
        "description": [
            "Own physical and software systems for a live factory-scale robotics platform.",
            "Tune vision networks, debug robot reliability, deploy subsystems, and improve throughput.",
            "Build and debug full robotic systems across software, hardware, and process.",
            "Use mechanical CAD, low-level Python or C++, electronics, PLCs, industrial sensors, and motion control.",
            "Work full-time on-site in South Deerfield, Massachusetts for at least two years.",
            "The company describes this as an early-career, high-ownership opportunity.",
        ],
        "confirm": [
            "Current U.S. work authorization: Yes, through OPT eligibility.",
            "Future employment sponsorship required: Yes.",
            "Willing to relocate and work on-site in South Deerfield, Massachusetts.",
            "No cover letter or motivation response is required or materially useful.",
        ],
    },
    {
        "folder": "applied-intuition-software-engineer-cpp",
        "company": "Applied Intuition",
        "role": "Software Engineer - C++",
        "location": "Sunnyvale, CA - On-site",
        "listingUrl": (
            "https://jobs.ashbyhq.com/applied/"
            "c9473dcb-f651-47bb-9a59-4150bddcdaa8"
        ),
        "url": (
            "https://jobs.ashbyhq.com/applied/"
            "c9473dcb-f651-47bb-9a59-4150bddcdaa8/application"
        ),
        "summary": (
            "C++ Autonomous Systems Software Engineer pursuing an M.S. in Robotics "
            "and Autonomous Systems (AI) at Arizona State University, with a B.S. in "
            "Computer Science. Hands-on experience implementing autonomy software in "
            "modern C/C++ and Python across perception, localization, state estimation, "
            "motion planning, controls, simulation, sensor integration, testing, and "
            "physical robot validation. Strong Linux and software-engineering foundation "
            "with ROS/ROS 2 concepts, Gazebo, CARLA, algorithms, data structures, "
            "debugging, APIs, CI/CD, Docker, documentation, and production code."
        ),
        "skills_add": (
            "Role Emphasis: Modern C++, C++11 and Above, Autonomous Systems, Onboard "
            "Application Software, Physical AI, Robotics, Interface Contracts, "
            "Execution Models, Cross-Stack Integration, Embedded Software Concepts, "
            "Real-Time Systems Concepts, Python Tooling, Testing, Debugging"
        ),
        "project_edits": {
            0: (
                "Emphasized autonomous-driving perception and localization software, "
                "camera-LiDAR integration, performance optimization, and robust testing."
            ),
            1: (
                "Emphasized onboard physical-robot control, state estimation, sensor "
                "fusion, real-time behavior, safety checks, and hardware validation."
            ),
            2: (
                "Emphasized autonomy algorithms, C++-adjacent software architecture "
                "concepts, ROS/Gazebo interfaces, planning, and validation."
            ),
        },
        "keywords": [
            "modern C++",
            "C++11",
            "autonomous systems",
            "onboard application software",
            "physical AI",
            "robotics",
            "interface contracts",
            "execution models",
            "cross-stack integration",
            "embedded software",
            "real-time systems",
            "Python",
            "testing",
            "debugging",
        ],
        "gap": (
            "One year of professional ownership shipping complex modern-C++ products "
            "is not verified. The resume truthfully emphasizes substantial graduate "
            "robotics work using C/C++, Python, autonomy algorithms, physical robot "
            "controls, ROS/Gazebo, CARLA, Linux, testing, debugging, and production "
            "software engineering."
        ),
        "description": [
            "Design and implement onboard application software in modern C++.",
            "Build autonomy-stack software for intelligent vehicles and robotic systems.",
            "Collaborate across interfaces, contracts, and execution models.",
            "Bachelor's degree plus one year of experience shipping complex C++11+ software.",
            "Robotics graduate research and embedded or onboard software are preferred.",
            "Work primarily from the Sunnyvale office five days per week.",
        ],
        "confirm": [
            "Current U.S. work authorization: Yes, through OPT eligibility.",
            "Future employment sponsorship required: Yes.",
            "Willing to work in-office five days per week in Sunnyvale.",
            "A required why-company response is included and approval-bound; no optional cover-letter PDF is needed.",
        ],
        "responses": {
            "application-responses.json": json.dumps(
                {
                    "linkedin": (
                        "https://www.linkedin.com/in/george-j-1829112a2/"
                    ),
                    "current_company": "Arizona State University",
                    "onsite_five_days": "Yes",
                    "source": "Search engine",
                    "source_detail": "Company job page",
                    "why_applied_intuition": (
                        "Applied Intuition's work on the software infrastructure and "
                        "autonomy stacks behind physical AI closely matches my focus on "
                        "robotics software that must perform on real systems. At ASU, I "
                        "built camera-LiDAR perception and localization in CARLA, "
                        "implemented ROS/Gazebo motion planning, and developed closed-loop "
                        "control and sensor fusion on a physical MiniDrone. I want to "
                        "bring that C++/Python autonomy experience and production software "
                        "discipline to onboard systems used across vehicles and machines."
                    ),
                    "interview_language": "C++",
                    "future_sponsorship": "Yes",
                    "race": "Asian (Not Hispanic or Latino)",
                },
                indent=2,
            ),
        },
    },
]


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
    base = load_base()
    builder = base.load_builder()
    reference_pages = builder.render_png(REFERENCE, "reference-kforce")
    summary: list[dict[str, Any]] = []

    for role in ROLES:
        resume = builder.render_resume(role)
        folder = resume.parent
        base.write_role_files(role, folder)
        response_paths: list[Path] = []
        for filename, content in role.get("responses", {}).items():
            response_path = folder / filename
            response_path.write_text(content.rstrip() + "\n", encoding="utf-8")
            response_paths.append(response_path)

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
        manifest_command = [
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
        ]
        for response_path in response_paths:
            manifest_command.extend(["--response", str(response_path)])
        manifest_command.extend(["--out", str(manifest)])
        run_checked(manifest_command)

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
                "responses": [str(path) for path in response_paths],
                "ats": report["keywordCoverage"],
                "pageFillRatios": report["pageFillRatios"],
                "confirm": role["confirm"],
            }
        )

    output = OUT_ROOT / "otp-replacement-package-summary.json"
    output.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
