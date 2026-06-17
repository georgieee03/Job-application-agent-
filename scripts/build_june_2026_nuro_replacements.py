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


COMMON_CONFIRM = [
    "Current U.S. work authorization: Yes, through OPT eligibility.",
    "Future employment sponsorship required: Yes.",
    "Earliest start date: two weeks.",
    "Willing to relocate and work from Nuro's Bay Area offices.",
    "No cover letter is required or materially useful for this application.",
]


ROLES: list[dict[str, Any]] = [
    {
        "folder": "nuro-software-engineer-ai-platform-new-grad",
        "company": "Nuro",
        "role": "Software Engineer, AI Platform - New Grad",
        "location": "Mountain View, CA - Hybrid",
        "listingUrl": "https://www.nuro.ai/careersitem?gh_jid=7351066",
        "url": (
            "https://job-boards.greenhouse.io/embed/job_app"
            "?for=nuro&token=7351066"
        ),
        "summary": (
            "New-Grad Robotics and AI Platform Software Engineer pursuing an M.S. "
            "in Robotics and Autonomous Systems (AI) at Arizona State University, "
            "with a B.S. in Computer Science. Hands-on experience building C++ and "
            "Python autonomy software, camera-LiDAR data and training pipelines, "
            "robotics simulation, Linux systems, Docker workflows, CI/CD, backend "
            "services, and performance-focused ML infrastructure. Strong background "
            "in distributed data processing, computer vision, GPU-enabled PyTorch, "
            "ROS/Gazebo concepts, testing, debugging, and production software."
        ),
        "skills_add": (
            "Role Emphasis: AI Platform, Data Platform, Onboard Systems, Technical "
            "Infrastructure, Distributed Systems, Data Processing, ML Infrastructure, "
            "Simulation, C++, Python, Linux, Docker, CI/CD, Multithreading Concepts, "
            "CPU/GPU Compute, Robotics Software Frameworks, Performance Optimization"
        ),
        "project_edits": {
            0: (
                "Emphasized camera-LiDAR data ingestion, ML training and evaluation "
                "pipelines, GPU-enabled PyTorch, simulation, and performance analysis."
            ),
            2: (
                "Emphasized C++/Python robotics algorithms, simulation infrastructure, "
                "Linux/ROS concepts, testing, and repeatable data-driven validation."
            ),
        },
        "keywords": [
            "AI Platform",
            "Data Platform",
            "Onboard Systems",
            "Technical Infrastructure",
            "distributed systems",
            "data processing",
            "ML infrastructure",
            "simulation",
            "C++",
            "Python",
            "Linux",
            "Docker",
            "CI/CD",
            "multithreading",
            "CPU",
            "GPU",
            "robotics software frameworks",
            "performance optimization",
        ],
        "gap": (
            "Professional ownership of hundred-petabyte storage, production onboard "
            "vehicle platforms, FPGA systems, and low-level multithreaded runtime "
            "infrastructure is not verified. The resume truthfully emphasizes verified "
            "C++/Python robotics work, ML and data pipelines, Linux, Docker, CI/CD, "
            "simulation, GPU-enabled PyTorch, backend systems, and performance tuning."
        ),
        "description": [
            "Join Data Platform, Onboard Systems, ML Infrastructure, Simulation, or Technical Infrastructure.",
            "Build data ingestion, annotation, mining, evaluation, simulation, compute, storage, and CI/CD systems.",
            "Integrate autonomy software and hardware safely and reliably.",
            "Use C++, Python, distributed systems, data processing, ML, multithreading, and CPU/GPU compute.",
            "Current bachelor's or master's candidate in CS, EE, Robotics, or a related field.",
            "Graduate before July 2026 and work four days per week from a Bay Area office.",
        ],
        "confirm": [
            *COMMON_CONFIRM,
            "Expected M.S. graduation is July 2026; the listing says graduating before July 2026, so timing may be reviewed by Nuro.",
        ],
    },
    {
        "folder": "nuro-software-engineer-performance-new-grad",
        "company": "Nuro",
        "role": "Software Engineer, Performance - New Grad",
        "location": "Mountain View, CA - Hybrid",
        "listingUrl": "https://www.nuro.ai/careersitem?gh_jid=7978432",
        "url": (
            "https://job-boards.greenhouse.io/embed/job_app"
            "?for=nuro&token=7978432"
        ),
        "summary": (
            "New-Grad Autonomous Systems Software Engineer pursuing an M.S. in "
            "Robotics and Autonomous Systems (AI) at Arizona State University, with "
            "a B.S. in Computer Science. Hands-on experience building and profiling "
            "C++ and Python robotics software, optimizing latency-sensitive ML and "
            "data pipelines, integrating sensors and controls, and validating "
            "performance on real and simulated systems. Strong Linux foundation with "
            "GPU-enabled PyTorch, Docker, CI/CD, logging, debugging, computer vision, "
            "ROS/Gazebo concepts, and production backend optimization."
        ),
        "skills_add": (
            "Role Emphasis: AV Software Performance, C++, Linux, Operating Systems "
            "Concepts, Computer Architecture Concepts, Concurrent Software Concepts, "
            "Multithreading Concepts, Performance Profiling, Latency Optimization, "
            "Memory Management Concepts, CPU/GPU Compute, ROS, CUDA Concepts, Core "
            "Libraries, APIs, Debugging, Monitoring"
        ),
        "project_edits": {
            0: (
                "Emphasized GPU-enabled model execution, latency and throughput "
                "measurement, pipeline optimization, profiling, and performance validation."
            ),
            1: (
                "Emphasized real-time physical robot behavior, sensor/control timing, "
                "logging, debugging, safety checks, and repeatable performance tests."
            ),
        },
        "keywords": [
            "AV software performance",
            "C++",
            "Linux",
            "operating systems",
            "computer architecture",
            "concurrent software",
            "multithreading",
            "performance profiling",
            "latency optimization",
            "memory management",
            "CPU",
            "GPU",
            "ROS",
            "CUDA",
            "core libraries",
            "APIs",
            "debugging",
            "monitoring",
        ],
        "gap": (
            "Professional ownership of highly concurrent runtime systems, low-level "
            "memory management, x86/ARM porting, perf/VTune/BPF/Nsight, and Nvidia "
            "DriveOS is not verified. These are represented as concepts where needed; "
            "the resume emphasizes verified C++/Python, Linux, robotics, GPU-enabled "
            "PyTorch, latency optimization, logging, testing, and performance analysis."
        ),
        "description": [
            "Analyze, profile, debug, monitor, and optimize autonomous-vehicle software.",
            "Build systems for memory management, thread prioritization, and process lifetime management.",
            "Develop core libraries and APIs for high-performance autonomy code.",
            "Use strong C++, operating-system, computer-architecture, and concurrent-software fundamentals.",
            "Optimize across x86, ARM, GPUs, and SoCs and use performance profiling tools.",
            "ROS, CUDA, Nvidia GPUs, and DriveOS are bonus qualifications.",
        ],
        "confirm": [
            *COMMON_CONFIRM,
            "This is a systems-performance reach role; low-level concurrency and profiler ownership are explicit gaps.",
        ],
    },
    {
        "folder": "skild-ai-robotics-software-engineer",
        "company": "Skild AI",
        "role": "Robotics Software Engineer",
        "location": "Pittsburgh, PA or San Francisco, CA",
        "listingUrl": "https://job-boards.greenhouse.io/skildai-careers/jobs/4136373008",
        "url": "https://job-boards.greenhouse.io/skildai-careers/jobs/4136373008",
        "summary": (
            "Robotics Software Engineer pursuing an M.S. in Robotics and Autonomous "
            "Systems (AI) at Arizona State University, with a B.S. in Computer "
            "Science. Hands-on experience designing, implementing, and testing "
            "navigation, planning, controls, localization, SLAM, perception, sensor "
            "fusion, and machine-learning integration using C++, Python, ROS/ROS 2 "
            "concepts, Gazebo, CARLA, PyTorch, OpenCV, LiDAR, and cameras. Built and "
            "validated autonomy software on physical and simulated robots with strong "
            "Linux, testing, debugging, performance, and production software skills."
        ),
        "skills_add": (
            "Role Emphasis: Robotics Software, Navigation, Motion Planning, Controls, "
            "SLAM, Perception, Computer Vision, High-Level Behaviors, C++, Python, "
            "ROS/ROS 2, Real-Robot Deployment, Machine Learning Integration, Robot "
            "Monitoring, Performance Optimization, Reliability, Scalability"
        ),
        "project_edits": {
            0: (
                "Emphasized production-minded C++/Python perception, camera-LiDAR "
                "fusion, localization, model integration, performance, and robustness."
            ),
            1: (
                "Emphasized real-robot navigation, closed-loop controls, sensor fusion, "
                "automated testing, monitoring, safety, and iterative validation."
            ),
            2: (
                "Emphasized motion planning, ROS/Gazebo integration, collision "
                "avoidance, trajectory validation, and reusable robotics software."
            ),
        },
        "keywords": [
            "robotics software",
            "navigation",
            "motion planning",
            "controls",
            "SLAM",
            "perception",
            "computer vision",
            "high-level behaviors",
            "C++",
            "Python",
            "ROS",
            "ROS 2",
            "real robots",
            "machine learning integration",
            "robot monitoring",
            "performance optimization",
            "reliability",
            "scalability",
        ],
        "gap": (
            "Professional deployment across multiple customer sites and production "
            "manipulation software are not verified. The resume emphasizes verified "
            "real-robot controls and validation, navigation, motion planning, "
            "localization, camera-LiDAR perception, C++/Python, ROS/Gazebo concepts, "
            "ML integration, testing, and production software engineering."
        ),
        "description": [
            "Design, implement, and test navigation, planning, controls, SLAM, perception, manipulation, and high-level behaviors.",
            "Write production-level C++ and Python for robotic platforms.",
            "Integrate state-of-the-art machine-learning models into robots.",
            "Deploy, monitor, and improve robotic solutions for performance, reliability, and scalability.",
            "Use ROS/ROS 2 or other robotics middleware and strong software-engineering fundamentals.",
            "The team includes candidates ranging from new graduates to domain experts.",
        ],
        "confirm": [
            "Current U.S. work authorization: Yes, through OPT eligibility.",
            "Future employment sponsorship required: Yes.",
            "Earliest start date: two weeks.",
            "Willing to work in either Pittsburgh or San Francisco.",
            "No cover letter is required or materially useful for this application.",
            "No transcript is required because the candidate is a graduate applicant.",
        ],
        "responses": {
            "why-skild-ai.txt": (
                "Skild AI's goal of building general-purpose robotic intelligence "
                "aligns closely with my focus on autonomy, sensor fusion, planning, "
                "controls, and real-robot validation. In my ASU robotics work, I built "
                "camera-LiDAR perception and localization pipelines in CARLA and "
                "closed-loop MiniDrone localization and control on physical hardware. "
                "I want to help connect state-of-the-art machine learning with robust "
                "C++ and Python robotics software, then improve it through testing and "
                "deployment feedback across varied robotic platforms."
            ),
            "projects-and-accomplishments.txt": (
                "1. Efficient TransFuser camera-LiDAR perception: I redesigned a "
                "multi-task autonomous-driving pipeline using EfficientNetV2-S, "
                "reducing model parameters by 70% while improving held-out loss by "
                "8.7%. The system improved BEV segmentation by 25.4% and covered "
                "localization, depth, semantic segmentation, detection, and mapping.\n\n"
                "2. Parrot MiniDrone autonomous navigation: I implemented closed-loop "
                "PID control with inertial and visual sensor fusion on physical "
                "hardware. I built automated test sequences, logged sensor data, "
                "measured navigation performance, and added safety checks and "
                "failsafes for repeatable real-robot validation.\n\n"
                "3. Production ML and software performance: At DigiClips Media, I "
                "developed Python and PyTorch image-recognition and data-processing "
                "pipelines handling more than 10 million daily queries and reduced "
                "latency by 45% through data-driven analysis, testing, and performance "
                "optimization."
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

    output = OUT_ROOT / "replacement-package-summary.json"
    output.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
