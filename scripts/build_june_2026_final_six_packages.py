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
    "Willing to relocate and work on-site for this role.",
]


ROLES: list[dict[str, Any]] = [
    {
        "folder": "mvp-robotics-software-engineer",
        "company": "MVP Robotics",
        "role": "Robotics Software Engineer",
        "location": "Bradford, VT - On-site",
        "listingUrl": "https://job-boards.greenhouse.io/mvprobotics/jobs/4218213009",
        "url": "https://job-boards.greenhouse.io/mvprobotics/jobs/4218213009",
        "summary": (
            "Robotics Software Engineer pursuing an M.S. in Robotics and Autonomous "
            "Systems (AI) at Arizona State University, with a B.S. in Computer "
            "Science. Hands-on experience building and validating autonomy software "
            "across embedded systems concepts, C/C++, Python, Linux, ROS/ROS 2, SLAM, "
            "state estimation, Kalman-filter sensor fusion, camera-LiDAR perception, "
            "path planning, collision avoidance, and physical robot control. Strong "
            "background in real and simulated robot testing, debugging, safety checks, "
            "machine learning, and production-minded software engineering."
        ),
        "skills_add": (
            "Role Emphasis: Embedded Robotics, C/C++, Linux, Python, ROS/ROS 2, "
            "SLAM, Visual-Inertial Odometry Concepts, State Estimation, Kalman Filter, "
            "Sensor Fusion, Cameras, LiDAR, Radar Concepts, Path Planning, Obstacle "
            "Detection, Collision Avoidance, Machine Learning, Multi-Agent Concepts"
        ),
        "project_edits": {
            0: (
                "Emphasized camera-LiDAR perception, localization, state estimation, "
                "mapping, obstacle detection, and machine-learning evaluation."
            ),
            1: (
                "Emphasized physical robot PID control, inertial and visual sensor "
                "fusion, logging, safety checks, and repeatable hardware validation."
            ),
            2: (
                "Emphasized ROS/Gazebo motion planning, collision avoidance, and "
                "trajectory validation for autonomous navigation."
            ),
        },
        "keywords": [
            "embedded systems",
            "C++",
            "Linux",
            "Python",
            "ROS",
            "ROS 2",
            "SLAM",
            "visual inertial odometry",
            "state estimation",
            "Kalman filter",
            "sensor fusion",
            "camera",
            "LiDAR",
            "radar",
            "path planning",
            "obstacle detection",
            "collision avoidance",
            "machine learning",
            "deep learning",
            "multi-agent autonomy",
        ],
        "gap": (
            "Two full years of professional robotics industry ownership, radar "
            "integration, and production multi-agent autonomy are not verified. The "
            "listing counts internships and co-ops, and the resume truthfully emphasizes "
            "verified C++/Python robotics projects, physical robot controls, sensor "
            "fusion, camera-LiDAR perception, ROS/Gazebo, Linux, planning, and testing."
        ),
        "description": [
            "Develop novel capabilities and advanced autonomy for robotic systems.",
            "Use embedded systems, C/C++, Linux, Python, ROS/ROS2, SLAM, and state estimation.",
            "Integrate cameras, LiDAR, radar, and other perception sensors.",
            "Build path planning, obstacle detection, collision avoidance, and ML capabilities.",
            "Minimum bachelor's degree and two years of industry experience; internships and co-ops count.",
            "Work Monday through Friday from the Bradford, Vermont headquarters.",
        ],
        "confirm": [
            *COMMON_CONFIRM,
            "No cover letter is required or materially useful for this application.",
        ],
    },
    {
        "folder": "verne-robotics-software-engineer",
        "company": "Verne Robotics",
        "role": "Robotics Software Engineer",
        "location": "San Francisco, CA - On-site",
        "listingUrl": (
            "https://jobs.ashbyhq.com/Verne%20Robotics/"
            "34b8ec26-2bb0-47b0-912c-09fa0389b2c6"
        ),
        "url": (
            "https://jobs.ashbyhq.com/Verne%20Robotics/"
            "34b8ec26-2bb0-47b0-912c-09fa0389b2c6/application"
        ),
        "summary": (
            "Robotics Software Engineer pursuing an M.S. in Robotics and Autonomous "
            "Systems (AI) at Arizona State University, with a B.S. in Computer "
            "Science. Hands-on experience building robotics software in Python and "
            "C++ across device interfaces, sensor integration, controls, perception, "
            "localization, motion planning, data collection, simulation, and physical "
            "robot validation. Strong foundation in PyTorch, computer vision, Linux, "
            "ROS/ROS 2 concepts, Gazebo, testing, debugging, performance optimization, "
            "and reliable production software."
        ),
        "skills_add": (
            "Role Emphasis: Robotics Software, Python, C++, Device Interfaces, Robot "
            "Control, Sensor Integration, Data Collection, Data Processing, PyTorch, "
            "Computer Vision, Motion Planning, Simulation, Physical Robot Validation, "
            "Testing, Debugging, Performance Optimization"
        ),
        "project_edits": {
            0: (
                "Emphasized PyTorch perception, camera-LiDAR data processing, "
                "localization, performance optimization, and reusable evaluation code."
            ),
            1: (
                "Emphasized physical robot controls, sensor interfaces, data logging, "
                "debugging, safety checks, and real-time validation."
            ),
        },
        "keywords": [
            "robotics software",
            "Python",
            "C++",
            "device interfaces",
            "robot control",
            "sensor integration",
            "data collection",
            "data processing",
            "PyTorch",
            "computer vision",
            "motion planning",
            "simulation",
            "physical robots",
            "testing",
            "debugging",
            "performance optimization",
        ],
        "gap": (
            "Professional ownership of a shipped manipulation product and deep "
            "low-level device-interface development are not verified. The package "
            "emphasizes verified physical robot control, C++/Python robotics software, "
            "sensor fusion, perception, planning, PyTorch, simulation, testing, and "
            "production software experience without inflating ownership."
        ),
        "description": [
            "Build and optimize robotics software in Python and C++.",
            "Work across device interfaces, robot control, data collection, and processing.",
            "Develop reliable systems for real robotic platforms.",
            "Use strong Python skills, PyTorch, and robotics or computer-vision experience.",
            "Collaborate in a fast-moving, hands-on robotics startup.",
            "Work full time on-site in San Francisco.",
        ],
        "confirm": [
            *COMMON_CONFIRM,
            "The form asks whether authorization exists without sponsorship now or in the future; the truthful answer is No because future sponsorship is required.",
            "A required role-specific motivation response is included and approval-bound; no optional cover-letter PDF is needed.",
        ],
        "responses": {
            "application-responses.json": json.dumps(
                {
                    "willing_to_relocate": "Yes",
                    "why_verne": (
                        "Verne's focus on building reliable robotics software for "
                        "physical systems aligns with my work across robot controls, "
                        "sensor fusion, perception, and motion planning. At ASU, I built "
                        "closed-loop MiniDrone control with inertial and visual sensing "
                        "and developed camera-LiDAR perception and localization pipelines "
                        "in CARLA. I want to bring that combination of real-robot "
                        "validation, Python/C++ software, and production engineering to a "
                        "small team solving difficult manipulation and automation problems."
                    ),
                    "linkedin_profile": (
                        "https://www.linkedin.com/in/george-j-1829112a2/"
                    ),
                    "authorized_without_sponsorship_now_or_future": "No",
                    "willing_background_check": "Yes",
                },
                indent=2,
            ),
        },
    },
    {
        "folder": "lila-software-engineer-i-instrument-software",
        "company": "Lila Sciences",
        "role": "Software Engineer I, Instrument Software",
        "location": "Cambridge, MA - On-site",
        "listingUrl": "https://job-boards.greenhouse.io/lilasciences/jobs/4186444009",
        "url": "https://job-boards.greenhouse.io/lilasciences/jobs/4186444009",
        "summary": (
            "Instrument Automation Software Engineer pursuing an M.S. in Robotics and "
            "Autonomous Systems (AI) at Arizona State University, with a B.S. in "
            "Computer Science. Hands-on experience integrating software with physical "
            "robotics hardware, sensors, actuators, controls, and data pipelines using "
            "Python, C/C++, Linux, ROS/ROS 2 concepts, Docker, Git, testing, logging, "
            "and structured debugging. Built real-robot control and sensor-fusion "
            "workflows and production backend systems, with a practical focus on "
            "reliable interfaces, APIs, documentation, and hardware-software diagnosis."
        ),
        "skills_add": (
            "Role Emphasis: Instrument Software, Laboratory Automation, Robotics "
            "Hardware Integration, Python, C#/.NET Concepts, Device Drivers Concepts, "
            "Cloud-to-Edge Integration, APIs, Testing, Debugging, Troubleshooting, "
            "Technical Documentation, Git, End Users, AI Driven Development"
        ),
        "project_edits": {
            1: (
                "Emphasized physical hardware integration, sensor/control interfaces, "
                "logging, troubleshooting, automated tests, and safety checks."
            ),
            4: (
                "Emphasized upcoming laboratory-style automation concepts involving "
                "sensors, actuators, control logic, and documented system integration."
            ),
        },
        "keywords": [
            "instrument software",
            "laboratory automation",
            "robotics",
            "hardware integration",
            "Python",
            "C#",
            ".NET",
            "device drivers",
            "cloud",
            "edge",
            "APIs",
            "testing",
            "debugging",
            "troubleshooting",
            "technical documentation",
            "Git",
            "end users",
            "AI driven development",
        ],
        "gap": (
            "Direct laboratory-instrument and C#/.NET production experience are not "
            "verified. The resume labels those as concepts and emphasizes verified "
            "Python, physical robot integration, sensors and controls, backend APIs, "
            "Linux, testing, debugging, documentation, and production software work."
        ),
        "description": [
            "Develop software connecting robotic arms, liquid handlers, sensors, and control software.",
            "Integrate lab instruments across cloud, edge, and device-execution infrastructure.",
            "Test, debug, and troubleshoot drivers and hardware-software interfaces.",
            "Document driver interfaces, APIs, and integration methods.",
            "Use Python, C#/.NET, or other suitable languages and collaborate with multidisciplinary teams.",
            "Provide a required response explaining why Lila, why this role, and why now.",
        ],
        "confirm": [
            *COMMON_CONFIRM,
            "A required role-specific motivation response is included and approval-bound; no optional cover-letter PDF is needed.",
        ],
        "responses": {
            "application-responses.json": json.dumps(
                {
                    "why_lila_why_role_why_now": (
                        "Lila's instrument software role matches the part of robotics "
                        "work I find most compelling: making software, sensors, controls, "
                        "and physical hardware operate as one reliable system. In my ASU "
                        "robotics work, I built closed-loop MiniDrone control with inertial "
                        "and visual sensor fusion, automated tests, logging, safety checks, "
                        "and repeatable validation on physical hardware. I also developed "
                        "production Python services and data pipelines at DigiClips, where "
                        "testing and performance analysis reduced latency by 45% at a scale "
                        "of more than 10 million daily queries. This role is timely because "
                        "I am completing my M.S. in Robotics and Autonomous Systems in July "
                        "2026 and want to apply that combination of robotics integration and "
                        "production software engineering to autonomous scientific "
                        "instruments. Lila's goal of accelerating discovery through AI-enabled "
                        "laboratories gives that systems work a clear and meaningful outcome."
                    )
                },
                indent=2,
            ),
        },
    },
    {
        "folder": "standard-subsea-swe-robotics",
        "company": "Standard Subsea",
        "role": "SWE, Robotics",
        "location": "El Segundo, CA - On-site",
        "listingUrl": (
            "https://jobs.ashbyhq.com/standardsubsea/"
            "6689c77a-fccf-47df-abb4-8bca5b28cf2a"
        ),
        "url": (
            "https://jobs.ashbyhq.com/standardsubsea/"
            "6689c77a-fccf-47df-abb4-8bca5b28cf2a/application"
        ),
        "summary": (
            "Generalist Robotics Software Engineer pursuing an M.S. in Robotics and "
            "Autonomous Systems (AI) at Arizona State University, with a B.S. in "
            "Computer Science. Hands-on experience across C++, Python, ROS/ROS 2, "
            "Linux, embedded systems concepts, sensor integration, state estimation, "
            "controls, perception, navigation, logging, simulation, and physical robot "
            "validation. Comfortable debugging across hardware and software boundaries, "
            "building automated tests, analyzing system performance, and producing "
            "reliable software for real-world robotic systems."
        ),
        "skills_add": (
            "Role Emphasis: Marine Robotics, Generalist Robotics Engineering, C++, "
            "Python, ROS, ROS2, Linux, Embedded Systems Concepts, Sensor Integration, "
            "State Estimation, Controls, Navigation, Hardware Software Integration, "
            "Field Testing, Logging, System Debugging, Reliability"
        ),
        "project_edits": {
            1: (
                "Emphasized real-hardware controls, sensor fusion, logging, safety "
                "checks, debugging, and field-style validation."
            ),
            2: (
                "Emphasized ROS/Gazebo planning, simulation, collision avoidance, and "
                "repeatable autonomous-system testing."
            ),
        },
        "keywords": [
            "marine robotics",
            "robotics engineering",
            "C++",
            "Python",
            "ROS",
            "ROS2",
            "Linux",
            "embedded systems",
            "sensor integration",
            "state estimation",
            "controls",
            "navigation",
            "hardware software integration",
            "field testing",
            "logging",
            "system debugging",
            "reliability",
        ],
        "gap": (
            "Marine systems, subsea vehicles, and post-graduation industry ownership "
            "are not verified. The role requests one to two years of industry or "
            "research experience, and the package truthfully emphasizes substantial "
            "graduate robotics research and coursework, physical robot controls, "
            "C++/Python, ROS/Gazebo, sensing, planning, Linux, and debugging."
        ),
        "description": [
            "Develop and maintain C++ and Python robotics software using ROS/ROS2.",
            "Integrate software, hardware, sensors, and controls for marine robotic platforms.",
            "Debug real systems and improve reliability through testing and field feedback.",
            "Work as a hands-on generalist rather than an ML-only engineer.",
            "Degree in robotics, mechatronics, computer engineering, or a related field.",
            "One to two years of industry or research experience after graduation is preferred.",
        ],
        "confirm": [
            *COMMON_CONFIRM,
            "The current U.S. work authorization selection is Work Visa, reflecting current F-1 OPT authorization.",
            "A required project response is included and approval-bound; no optional cover-letter PDF is needed.",
        ],
        "responses": {
            "application-responses.json": json.dumps(
                {
                    "linkedin_url": (
                        "https://www.linkedin.com/in/george-j-1829112a2/"
                    ),
                    "onsite_or_relocate": "Yes",
                    "current_us_work_authorization_status": "Work Visa",
                    "proud_project": (
                        "I am most proud of the autonomous-control system I built for a "
                        "physical Parrot MiniDrone. I implemented closed-loop PID control "
                        "for yaw, velocity, and altitude, fused inertial and visual sensor "
                        "data, and added logging, automated test sequences, safety checks, "
                        "and failsafes. The project taught me how to diagnose behavior "
                        "across software, sensors, and hardware and turn repeated physical "
                        "tests into measurable improvements."
                    ),
                },
                indent=2,
            ),
        },
    },
    {
        "folder": "molg-robotics-engineer-path-planning",
        "company": "Molg",
        "role": "Robotics Engineer (Path Planning)",
        "location": "Sterling, VA - On-site",
        "listingUrl": (
            "https://jobs.ashbyhq.com/Molg/"
            "ed85e53f-dcb9-4f83-8044-01baa29313fd"
        ),
        "url": (
            "https://jobs.ashbyhq.com/Molg/"
            "ed85e53f-dcb9-4f83-8044-01baa29313fd/application"
        ),
        "summary": (
            "Robotics Path Planning Engineer pursuing an M.S. in Robotics and "
            "Autonomous Systems (AI) at Arizona State University, with a B.S. in "
            "Computer Science. Hands-on experience implementing motion planning and "
            "collision avoidance in Python with ROS and Gazebo, alongside C/C++, "
            "robot kinematics, trajectory optimization, perception, state estimation, "
            "controls, and physical robot validation. Strong software foundation in "
            "algorithms, data structures, testing, debugging, documentation, Linux, "
            "and production code."
        ),
        "skills_add": (
            "Role Emphasis: Industrial Robotics, Arm Motion Planning, Path Planning, "
            "Collision Detection, Collision Avoidance, Geometric Reasoning, Robot "
            "Kinematics, Multi-Arm Coordination Concepts, Shared Workspace Reasoning, "
            "C++, Python, ROS2, Custom Planners, Robot Hardware Integration"
        ),
        "project_edits": {
            2: (
                "Emphasized 3D RRT implementation, collision detection and avoidance, "
                "trajectory optimization, ROS/Gazebo integration, and validation."
            ),
            3: (
                "Emphasized constrained-joint kinematics, actuator placement, and "
                "URDF-ready robot modeling for planning and controls."
            ),
        },
        "keywords": [
            "industrial robotics",
            "motion planning",
            "path planning",
            "collision detection",
            "collision avoidance",
            "geometric reasoning",
            "robot kinematics",
            "multi-arm coordination",
            "shared workspace",
            "C++",
            "Python",
            "ROS2",
            "custom planners",
            "robot hardware",
        ],
        "gap": (
            "Professional multi-arm industrial-cell deployment and production "
            "coordination algorithms are not verified. The resume truthfully emphasizes "
            "verified 3D RRT planning, collision avoidance, trajectory optimization, "
            "kinematics, ROS/Gazebo, C++/Python, simulation validation, and physical "
            "robot controls."
        ),
        "description": [
            "Build the motion-planning core for robotic microfactories.",
            "Design motion and path planning for arm-based robots in dense multi-arm cells.",
            "Develop collision detection, avoidance, and shared-workspace reasoning.",
            "Integrate planning software with real robotic hardware and controllers.",
            "Use C++ and/or Python plus ROS2 or custom robotics middleware.",
            "Work five days per week from Molg's Sterling, Virginia headquarters.",
        ],
        "confirm": [
            *COMMON_CONFIRM,
            "The truthful visa-sponsorship answer is Yes.",
            "Salary expectation is 150000, within the posted 130000-175000 base range.",
            "Notice period is two weeks.",
            "No optional cover-letter response is needed beyond the required form fields.",
        ],
        "responses": {
            "application-responses.json": json.dumps(
                {
                    "linkedin": (
                        "https://www.linkedin.com/in/george-j-1829112a2/"
                    ),
                    "visa_sponsorship": "Yes",
                    "onsite_virginia": "Yes",
                    "salary_expectations": 150000,
                    "notice_period": "Two weeks",
                    "source": "Company website",
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

    output = OUT_ROOT / "final-six-package-summary.json"
    output.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
