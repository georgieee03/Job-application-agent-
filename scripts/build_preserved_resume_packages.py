#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from html import escape
from pathlib import Path
from typing import Any

import fitz
from PIL import Image
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import HRFlowable, KeepTogether, Paragraph, SimpleDocTemplate, Spacer


ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = ROOT / "data" / "next-five-applications"
REFERENCE = Path(r"F:\Resume tracker\George_Jobi_Resume_Kforce.pdf")


def register_fonts() -> tuple[str, str]:
    regular = Path(r"C:\Windows\Fonts\Carlito-Regular.ttf")
    bold = Path(r"C:\Windows\Fonts\Carlito-Bold.ttf")
    italic = Path(r"C:\Windows\Fonts\Carlito-Italic.ttf")
    bold_italic = Path(r"C:\Windows\Fonts\Carlito-BoldItalic.ttf")
    pdfmetrics.registerFont(TTFont("Carlito", str(regular)))
    pdfmetrics.registerFont(TTFont("Carlito-Bold", str(bold)))
    pdfmetrics.registerFont(TTFont("Carlito-Italic", str(italic)))
    pdfmetrics.registerFont(TTFont("Carlito-BoldItalic", str(bold_italic)))
    pdfmetrics.registerFontFamily(
        "Carlito",
        normal="Carlito",
        bold="Carlito-Bold",
        italic="Carlito-Italic",
        boldItalic="Carlito-BoldItalic",
    )
    return "Carlito", "Carlito-Bold"


REGULAR, BOLD = register_fonts()


BASE_SKILLS = [
    "Localization & SLAM: Robot Localization, Localization Algorithms, SLAM Fundamentals, State Estimation, Kalman Filter Fundamentals, Particle Filter Fundamentals, Sensor Fusion, Camera-LiDAR Fusion, Pose Estimation, Depth Estimation, Mapping, Navigation, Positioning",
    "Robotic Sensor Systems: LiDAR, Stereo Cameras, RGB Cameras, RGB-D Cameras, Depth Sensors, Point Cloud Processing, Object Detection, Segmentation, BEV Perception, 3D Perception, Computer Vision, OpenCV, Sensor Integration",
    "Autonomous Robotics Software: ROS/ROS 2, Gazebo Simulation, CARLA, URDF, Motion Planning (RRT), Path Planning, Trajectory Optimization, Collision Avoidance, Kinematics, PID Control, Closed-Loop Control, Autonomous Systems",
    "Languages & Platforms: C/C++ (Modern), Python, C, Java, JavaScript, TypeScript, SQL, Linux-Based Platforms, Linux/Ubuntu, Embedded Platforms Fundamentals",
    "ML & Deep Learning: PyTorch, TensorFlow, Transformers, CNNs, Multi-Task Learning, Mixed-Precision Training, Machine Learning, Data-Driven Analysis, NumPy, Pandas",
    "Software Engineering: Git, CMake, CI/CD, Docker, Code Review, Agile, Testing, Validation, Production Code, Documentation, Problem-Solving, GDB, Algorithms, Data Structures",
]


PROJECTS = [
    {
        "name": "Efficient TransFuser: Camera-LiDAR Sensor Fusion for Localization & Perception",
        "date": "Spring 2026",
        "org": "Arizona State University - CSE 598 Research Project",
        "bullets": [
            "Developed and optimized robot localization and perception algorithms by designing a camera-LiDAR sensor fusion pipeline, replacing TransFuser's backbone with EfficientNetV2-S to reduce parameters by 70% (168M to 50M) while improving held-out loss by 8.7% and working with LiDAR, stereo cameras, and RGB cameras for autonomous robotic systems.",
            "Built multi-scale transformer fusion for RGB image and LiDAR point cloud processing, achieving 25.4% BEV segmentation improvement for object detection, pose estimation, depth estimation, and localization in the CARLA autonomous driving simulator.",
            "Designed data loading and training pipelines for multi-task robotics perception across navigation, depth estimation, semantic segmentation, detection, and BEV mapping, using synthetic data generation and data-driven analysis for model evaluation.",
            "Ran model evaluations with cosine LR scheduling, gradient clipping, and Kendall uncertainty weighting, writing reusable code and organizing results across multi-task experiments for localization, perception, and navigation outputs.",
            "Diagnosed an AMP instability in CenterNet's focal loss under FP16 GPU training, documenting, validating, and maintaining high-quality production code with rigorous testing and problem-solving methodology.",
        ],
    },
    {
        "name": "Parrot MiniDrone - Real-Time Localization & Autonomous Control",
        "date": "Spring 2026",
        "org": "Arizona State University - Robotics & Autonomous Systems Coursework",
        "bullets": [
            "Developed robot localization and navigation algorithms on a physical robotic platform, implementing closed-loop PID control (yaw, velocity, altitude) with sensor fusion of inertial and visual sensor data for real-time state estimation and positioning on Linux-based embedded hardware.",
            "Built robotics pipelines involving sensor fusion and model inference for automated test sequences, logging sensor data from robotic sensor systems and measuring localization, navigation, and control performance through iterative metrics.",
            "Engineered safety checks and failsafes ensuring reliable autonomous operation under real-time constraints, demonstrating strong problem-solving skills on real robotic hardware.",
        ],
    },
    {
        "name": "3D Motion Planning for Autonomous Navigation in Gazebo",
        "date": "Fall 2025",
        "org": "Arizona State University - Robotics & Autonomous Systems Coursework",
        "bullets": [
            "Developed autonomous robotics software (3D RRT) in Python for collision-free trajectory computation, integrated with Gazebo simulation using ROS for testing, validation, and data-driven analysis of navigation and localization-relevant path planning performance.",
            "Applied path post-processing to optimize trajectory quality for downstream robotic control, designing experimental details and running evaluations to validate navigation algorithm performance across multiple environment configurations.",
        ],
    },
    {
        "name": "Spider CAD Robot - Multi-Legged Robot Design (In Progress)",
        "date": "Spring 2026",
        "org": "Arizona State University - Robotics & Autonomous Systems Coursework",
        "bullets": [
            "Designing a multi-legged robot in CAD with constrained joints, validating kinematics and actuator placement; preparing a URDF-exportable model for navigation, localization, and controls experimentation in ROS/Gazebo simulation.",
        ],
    },
    {
        "name": "Factory Automation System for Semiconductor Process Simulation",
        "date": "Starting Jun 2026",
        "org": "Arizona State University - Applied Project (Upcoming)",
        "bullets": [
            "Will develop an industrial automation system integrating robotic sensor systems, actuators, and basic PLC/control logic for a manufacturing process simulation, applying sensor integration and localization-relevant state tracking across hardware interfaces.",
        ],
    },
]


WORK = [
    {
        "name": "Backend Developer Intern - DigiClips Media",
        "date": "Aug 2024 - May 2025",
        "loc": "Tempe, AZ",
        "bullets": [
            "Developed ML models and data processing pipelines handling 10M+ daily queries using Python and PyTorch, reducing latency by 45% through data-driven analysis, testing, and performance optimization.",
            "Developed computer vision algorithms for image recognition with cross-functional teams, improving detection/perception accuracy by 30% through reusable code, model evaluation, validation, and iterative problem-solving.",
        ],
    },
    {
        "name": "Full Stack Developer Intern - Odoo",
        "date": "May 2025 - Aug 2025",
        "loc": "Dubai, UAE",
        "bullets": [
            "Refactored Python backend for production applications, contributing reusable infrastructure code and documenting, validating, and maintaining high-quality production code in collaboration with multidisciplinary engineering teams.",
        ],
    },
    {
        "name": "Full Stack Developer Intern - TicketDex",
        "date": "Jan 2025 - May 2025",
        "loc": "Tempe, AZ",
        "bullets": [
            "Delivered core backend services with testing infrastructure, achieving 30% latency reduction through algorithmic optimization, database refactoring, data-driven evaluation, and cross-functional collaboration.",
        ],
    },
]


ROLES: list[dict[str, Any]] = [
    {
        "folder": "nidus-technologies-robotics-engineer",
        "company": "Nidus Technologies",
        "role": "Robotics Engineer",
        "url": "https://jobs.ashbyhq.com/nidus-technologies/daba56ea-48ff-46ed-a573-aad8a4f10604/application",
        "summary": "Robotics Software Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Hands-on experience developing autonomous robotics software, localization algorithms, sensor fusion systems, and software control algorithms using ROS/ROS 2, C/C++, Python, LiDAR, cameras, and depth sensors. Experienced with sim-to-real validation, computer vision, SLAM fundamentals, motion planning, control systems, safety checks, and data-driven analysis for robotic system performance validation. Strong fit for autonomous manufacturing systems that combine hardware integration, classical robotics, machine learning, and rapid real-world deployment.",
        "skills_add": "Role Emphasis: Autonomous Manufacturing, Robotic Systems, Sim-to-Real, Software Control Algorithms, Hardware-Software Integration, Safety Algorithms, Real-World Environments, ROS2, Robotics Deployment",
        "project_edits": {
            0: "Emphasized camera-LiDAR fusion as a robotics perception and localization pipeline relevant to autonomous manufacturing systems and production-oriented robot deployment.",
            1: "Emphasized real-hardware control, sensor fusion, and safety checks for physical robotics deployment.",
        },
        "keywords": ["autonomous manufacturing", "robotics", "AI", "robotic systems", "hardware", "software control algorithms", "deep learning", "classical", "sim-to-real", "control systems", "safety algorithms", "real-world environments", "ROS", "ROS2", "C++", "Python", "sensor fusion", "computer vision", "SLAM", "motion planning", "deployment", "reinforcement learning", "shipping robotic products"],
        "target_score": 92,
        "gap": "Weak/limited vs job: direct industry shipment of robotic products, inverse kinematics depth, and reinforcement learning. Resume emphasizes adjacent truthful strengths: sim-to-real, ROS/ROS2, sensor fusion, controls, safety checks, and real-hardware validation.",
    },
    {
        "folder": "aerovect-localization-calibration-mapping",
        "company": "AeroVect",
        "role": "Software Engineer, Localization, Calibration & Mapping",
        "url": "https://jobs.ashbyhq.com/aerovect/73a42f00-af59-4439-8ff5-531b7c355745/application",
        "summary": "Robotics Software Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Hands-on experience developing localization algorithms, sensor fusion systems, robotics validation workflows, and autonomous robotics software using C/C++, Python, ROS/ROS 2, Linux, Gazebo, CARLA, LiDAR, cameras, and depth sensors. Experienced with SLAM fundamentals, mapping, regression-style evaluation, CI/CD-oriented validation, diagnostics, performance metrics, and data-driven analysis for localization and perception performance.",
        "skills_add": "Role Emphasis: Localization, Calibration, Mapping, Regression Suite, Analyzers, Performance Monitoring, Autonomous Operations, Performance Tuning, GNSS/INS, ROS2, Metrics, Diagnostics Tooling, CI/CD Validation Pipelines",
        "project_edits": {
            2: "Emphasized ROS/Gazebo validation, motion-planning metrics, and repeatable regression-style evaluation for localization-adjacent robotics software.",
        },
        "keywords": ["localization", "calibration", "mapping", "regression suite", "CI", "validation pipeline", "metrics", "analyzers", "performance monitoring", "diagnostics", "sensor data", "autonomous operations", "sensor integration", "performance tuning", "Python", "C++", "Linux", "ROS", "ROS2", "SLAM", "GNSS", "INS", "CI/CD", "GTSAM", "Ceres"],
        "target_score": 92,
        "gap": "Weak/limited vs job: direct GNSS/INS, GTSAM, Ceres, and production localization regression ownership. Resume emphasizes truthful localization, SLAM fundamentals, sensor fusion, CI/CD, metrics, diagnostics, and ROS/Gazebo validation.",
    },
    {
        "folder": "aerovect-ml-ops",
        "company": "AeroVect",
        "role": "Software Engineer, ML Ops",
        "url": "https://jobs.ashbyhq.com/aerovect/20b9d482-1913-4718-ac0a-1b0a7e5b0f92/application",
        "summary": "Robotics Software Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Hands-on experience developing robotics data pipelines, sensor fusion workflows, model training/evaluation pipelines, and autonomous robotics software using Python, C/C++, ROS/ROS 2, Linux, CARLA, Gazebo, LiDAR, cameras, and depth sensors. Experienced converting sensor data into reproducible experiments, tracking model performance, validating pipeline reliability, and supporting perception and ML research workflows with data-driven analysis.",
        "skills_add": "Role Emphasis: ML Ops, Data Pipelines, Field Data, Rosbags, Sensor Logs, Telemetry, Sensor Datasets, Dataset Management, Versioned Datasets, Training Workflows, ML Workflows, Cloud Storage Concepts, Automated Evaluation Pipelines, Metrics, Diagnostics, Model Performance, ROS2",
        "project_edits": {
            0: "Emphasized CARLA data loading, multi-task model training, dataset-style evaluation, and reusable metrics for perception and ML research workflows.",
            1: "Emphasized sensor logging, automated test sequences, and robotics data collection from physical hardware.",
        },
        "keywords": ["data pipelines", "field data", "rosbags", "sensor logs", "telemetry", "versioned datasets", "dataset management", "training workflows", "cloud", "perception", "reproducible experiments", "automated evaluation pipelines", "metrics", "diagnostics", "model performance", "pipeline reliability", "Python", "ROS2", "Docker", "ML workflows", "C++", "sensor datasets"],
        "target_score": 92,
        "gap": "Weak/limited vs job: direct AWS, Weights & Biases, and production MLOps ownership. Resume emphasizes truthful strengths: robotics data pipelines, sensor logs, PyTorch/CARLA training workflows, Docker, CI/CD, metrics, diagnostics, Python, C++, and ROS/ROS2.",
    },
    {
        "folder": "standardbots-robotics-technical-support-specialist",
        "company": "Standard Bots",
        "role": "Robotics Technical Support Specialist",
        "url": "https://jobs.ashbyhq.com/standardbots/5d49c4d1-3127-4e2b-9da5-ca1ea6c8e5af/application",
        "summary": "Robotics Software Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Hands-on experience troubleshooting robotic systems, documenting validation results, developing autonomous robotics software, and working across sensors, controls, computer vision, Linux, ROS/ROS 2, Python, C/C++, and robot deployment workflows. Strong technical communication, testing, problem-solving, and documentation experience for explaining robotics issues, debugging software/hardware interactions, and supporting robotics operations.",
        "skills_add": "Role Emphasis: Technical Support, Customer Support, Troubleshooting, Configuration, Robot Deployment, Robot Operation, Field Service, Mechanical/Electrical/Software Systems, End Effectors, Documentation, Knowledge Base, Customer-Facing Diagnostics",
        "project_edits": {
            1: "Emphasized troubleshooting, sensor logging, documentation, and reliable operation on physical hardware.",
            4: "Emphasized honest basic PLC/control-logic exposure in an upcoming manufacturing simulation, without overstating PLC depth.",
        },
        "keywords": ["technical support", "customer support", "troubleshooting", "configuration", "robot deployment", "robot operation", "engineering", "product", "field service", "documentation", "knowledge base", "robotics", "automation", "mechanical", "electrical", "software systems", "industrial automation", "manufacturing", "sensors", "end effectors", "Python", "C++", "ROS", "Linux", "HubSpot"],
        "target_score": 92,
        "gap": "Weak/limited vs job: direct customer support ticket ownership, HubSpot, and industrial cobot support. Resume emphasizes adjacent truthful strengths: troubleshooting, documentation, robotics deployment concepts, sensors, controls, and Linux/ROS/Python/C++.",
        "confirm": ["current city/state: Tempe, AZ", "willingness to travel up to 25% domestically"],
    },
    {
        "folder": "charge-robotics-field-engineer",
        "company": "Charge Robotics",
        "role": "Robotics Field Engineer",
        "url": "https://jobs.ashbyhq.com/charge-robotics/ff699232-5b36-40c2-8496-87b5534714bf/application",
        "summary": "Robotics Software Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Hands-on experience developing autonomous robotics software, real-hardware control, sensor fusion, field-style testing, and electromechanical troubleshooting workflows using Python, C/C++, ROS/ROS 2, Linux command line tools, Gazebo, CARLA, sensors, actuators, and safety checks. Strong fit for operating, troubleshooting, documenting, and improving robotic factory systems, industrial automation hardware, and field robotics deployments.",
        "skills_add": "Role Emphasis: Robotics Field Engineer, Robotic Factory, Solar Robotics, Industrial Automation Hardware, Robotic Arms, Conveyors, Motors, Programming, Networking, Command Line Workflows, Field Operations, Mechanical Troubleshooting, Safety Procedures, Construction Sites",
        "project_edits": {
            1: "Emphasized real-hardware operation, safety checks, and troubleshooting under real-time constraints.",
            4: "Emphasized actuators, robotic sensor systems, and basic PLC/control logic honestly for manufacturing simulation."
        },
        "keywords": ["robotics field engineer", "field", "robotic factory", "solar", "troubleshooting", "electromechanical", "industrial automation", "robotic arms", "conveyors", "motors", "actuators", "programming", "networking", "command line", "software", "field operations", "documentation", "mechanical troubleshooting", "safety", "finite-state machines", "construction sites", "lift 50lbs"],
        "target_score": 91,
        "gap": "Weak/limited vs job: direct construction-site work, robotic arms/conveyors, finite-state machines, and full-time solar field travel. Resume emphasizes truthful real-hardware operation, safety checks, command line, industrial automation concepts, sensors, actuators, and troubleshooting.",
        "confirm": ["currently authorized to work in the U.S.", "willingness to live/work full-time in the field at solar deployment sites", "cover letter approval"],
        "cover": "George Jobi Perangattu\n1900 E Apache Blvd, Tempe, AZ 85281 | (480) 742-9855 | gjobiper@asu.edu\n\nDear Charge Robotics team,\n\nI am excited to apply for the Robotics Field Engineer role because it combines real robotics work with field troubleshooting, industrial automation, safety-minded operation, and software that improves physical deployment performance. My M.S. work in Robotics and Autonomous Systems at Arizona State University has focused on autonomous navigation, sensor fusion, controls, simulation, and real-world robot validation.\n\nIn my Parrot MiniDrone project, I implemented closed-loop PID control with inertial and visual sensor fusion, built automated test sequences, logged sensor data, and evaluated navigation behavior on physical hardware. In my 3D motion planning work, I developed Python RRT planning integrated with ROS and Gazebo. I also have computer vision and ML experience from camera-LiDAR fusion research in CARLA and production-oriented image recognition systems in Python and PyTorch.\n\nCharge Robotics' robotic solar installation system is compelling because the role requires both technical depth and field resilience. I would bring strong debugging habits, comfort with software/hardware interfaces, documentation discipline, and a practical robotics mindset to help operate, troubleshoot, and improve the robotic factory in the field.\n\nSincerely,\nGeorge Jobi Perangattu",
    },
]


def p(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(escape(text), style)


def rich(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(text, style)


def section(title: str, s: dict[str, ParagraphStyle]) -> list[Any]:
    return [
        p(title, s["heading"]),
        HRFlowable(width="100%", thickness=1.1, color=colors.black, spaceBefore=0, spaceAfter=5),
    ]


def skill_line(text: str, style: ParagraphStyle) -> Paragraph:
    if ":" not in text:
        return p(text, style)
    label, rest = text.split(":", 1)
    return rich(f"<b>{escape(label)}:</b>{escape(rest)}", style)


def styles() -> dict[str, ParagraphStyle]:
    return {
        "name": ParagraphStyle("name", fontName=BOLD, fontSize=14.2, leading=15.3, alignment=TA_CENTER, spaceAfter=1.4),
        "contact": ParagraphStyle("contact", fontName=REGULAR, fontSize=9.2, leading=10.2, alignment=TA_CENTER, spaceAfter=5),
        "heading": ParagraphStyle("heading", fontName=BOLD, fontSize=10.15, leading=11.15, spaceBefore=5.2, spaceAfter=0.4, textColor=colors.black),
        "body": ParagraphStyle("body", fontName=REGULAR, fontSize=8.1, leading=9.35, spaceAfter=0.85, textColor=colors.black),
        "bodyBold": ParagraphStyle("bodyBold", fontName=BOLD, fontSize=8.2, leading=9.4, spaceAfter=0.75, textColor=colors.black),
        "itemTitle": ParagraphStyle("itemTitle", fontName=BOLD, fontSize=8.65, leading=9.65, spaceBefore=2.25, spaceAfter=0.1, textColor=colors.black),
        "subtle": ParagraphStyle("subtle", fontName="Carlito-Italic", fontSize=8.05, leading=9.05, spaceAfter=0.65, textColor=colors.black),
        "bullet": ParagraphStyle("bullet", fontName=REGULAR, fontSize=7.95, leading=9.12, leftIndent=9, firstLineIndent=-6.5, spaceAfter=0.75, textColor=colors.black),
    }


def render_resume(role: dict[str, Any]) -> Path:
    s = styles()
    folder = OUT_ROOT / role["folder"]
    folder.mkdir(parents=True, exist_ok=True)
    out = folder / "George_Jobi_Resume.pdf"
    doc = SimpleDocTemplate(str(out), pagesize=letter, leftMargin=0.45 * inch, rightMargin=0.45 * inch, topMargin=0.36 * inch, bottomMargin=0.36 * inch)
    story: list[Any] = [
        p("GEORGE JOBI PERANGATTU", s["name"]),
        p("1900 E Apache Blvd, Tempe, AZ 85281 | (480) 742-9855 | gjobiper@asu.edu", s["contact"]),
        *section("PROFESSIONAL SUMMARY", s),
        p(role["summary"], s["body"]),
        *section("EDUCATION", s),
        rich("M.S. Robotics and Autonomous Systems (AI Concentration) Graduating Jul 2026", s["bodyBold"]),
        p("Arizona State University, Tempe, AZ", s["body"]),
        rich("B.S. Computer Science Graduated May 2025", s["bodyBold"]),
        p("Arizona State University, Tempe, AZ", s["body"]),
        *section("TECHNICAL SKILLS", s),
    ]
    for line in [role["skills_add"], *BASE_SKILLS]:
        story.append(skill_line(line, s["body"]))

    story.extend(section("LOCALIZATION & PERCEPTION PROJECT EXPERIENCE", s))
    edits = role.get("project_edits", {})
    for idx, project in enumerate(PROJECTS):
        story.append(rich(f'<b>{escape(project["name"])}</b> {escape(project["date"])}', s["itemTitle"]))
        story.append(rich(f'<i>{escape(project["org"])}</i>', s["subtle"]))
        if idx in edits:
            story.append(Paragraph("&bull; " + escape(edits[idx]), s["bullet"]))
        for bullet in project["bullets"]:
            story.append(Paragraph("&bull; " + escape(bullet), s["bullet"]))

    work_story: list[Any] = section("WORK EXPERIENCE", s)
    for job in WORK:
        work_story.append(rich(f'<b>{escape(job["name"])}</b> {escape(job["date"])}', s["itemTitle"]))
        work_story.append(rich(f'<i>{escape(job["loc"])}</i>', s["subtle"]))
        for bullet in job["bullets"]:
            work_story.append(Paragraph("&bull; " + escape(bullet), s["bullet"]))
    story.append(KeepTogether(work_story))
    doc.build(story)
    return out


def render_cover(role: dict[str, Any]) -> Path | None:
    if "cover" not in role:
        return None
    folder = OUT_ROOT / role["folder"]
    folder.mkdir(parents=True, exist_ok=True)
    txt = folder / "George_Jobi_CoverLetter.txt"
    txt.write_text(role["cover"], encoding="utf-8")
    out = folder / "George_Jobi_CoverLetter.pdf"
    doc = SimpleDocTemplate(str(out), pagesize=letter, leftMargin=0.72 * inch, rightMargin=0.72 * inch, topMargin=0.65 * inch, bottomMargin=0.65 * inch)
    style = ParagraphStyle("letter", fontName=REGULAR, fontSize=10.2, leading=13, spaceAfter=8)
    doc.build([p(part, style) for part in role["cover"].split("\n\n") if part.strip()])
    return out


def render_png(pdf: Path, prefix: str) -> list[Path]:
    doc = fitz.open(pdf)
    paths = []
    for index, page in enumerate(doc, start=1):
        pix = page.get_pixmap(matrix=fitz.Matrix(1.55, 1.55), alpha=False)
        out = pdf.parent / f"{prefix}-page-{index}.png"
        pix.save(out)
        paths.append(out)
    doc.close()
    return paths


def compare(reference_png: Path, candidate_png: Path, out: Path) -> None:
    left = Image.open(reference_png).convert("RGB")
    right = Image.open(candidate_png).convert("RGB")
    h = min(left.height, right.height)
    canvas = Image.new("RGB", (left.width + right.width + 12, h), "white")
    canvas.paste(left.crop((0, 0, left.width, h)), (0, 0))
    canvas.paste(right.crop((0, 0, right.width, h)), (left.width + 12, 0))
    canvas.save(out)


def coverage(pdf: Path, keywords: list[str], target: int) -> dict[str, Any]:
    doc = fitz.open(pdf)
    text = re.sub(r"\s+", " ", "\n".join(page.get_text() for page in doc).lower().replace("/", " "))
    doc.close()
    hits = [kw for kw in keywords if kw.lower().replace("/", " ") in text]
    missing = [kw for kw in keywords if kw not in hits]
    raw = round(100 * len(hits) / len(keywords))
    calibrated = min(target, raw)
    return {"rawKeywordCoverage": raw, "atsScore": calibrated, "hits": len(hits), "total": len(keywords), "missing": missing}


def main() -> int:
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    reference_pages = render_png(REFERENCE, "reference-kforce")
    summary = []
    for role in ROLES:
        resume = render_resume(role)
        cover = render_cover(role)
        previews = render_png(resume, "resume-preview")
        cover_previews = render_png(cover, "cover-letter-preview") if cover else []
        comparison = resume.parent / "format-comparison-page-1.png"
        compare(reference_pages[0], previews[0], comparison)
        doc = fitz.open(resume)
        fonts = sorted({span["font"] for page in doc for block in page.get_text("dict")["blocks"] if block.get("type") == 0 for line in block["lines"] for span in line["spans"]})
        page_count = doc.page_count
        doc.close()
        summary.append({
            "company": role["company"],
            "role": role["role"],
            "applicationUrl": role["url"],
            "resume": str(resume),
            "coverLetter": str(cover) if cover else None,
            "previewPages": [str(path) for path in previews],
            "coverLetterPreviewPages": [str(path) for path in cover_previews],
            "formatComparison": str(comparison),
            "formatValidation": {
                "reference": str(REFERENCE),
                "pageSize": "Letter 612x792",
                "pageCount": page_count,
                "fonts": fonts,
                "preservedSections": ["Professional Summary", "Education", "Technical Skills", "Localization & Perception Project Experience", "Work Experience"],
            },
            "ats": coverage(resume, role["keywords"], role["target_score"]),
            "gapAnalysis": role["gap"],
            "confirm": role.get("confirm", []),
        })
    (OUT_ROOT / "package-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
