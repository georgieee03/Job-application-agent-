#!/usr/bin/env python3
from __future__ import annotations

import os as _profile_environment
if __name__ == "__main__" and _profile_environment.environ.get("JOB_APPLICATION_REVIEWED_LOCAL_HELPERS") != "true":
    raise SystemExit("Public example helper: configure local candidate facts, paths, role configuration, and authorization first; see docs/public-repository-setup.md.")

import argparse
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from html import escape
from pathlib import Path
from typing import Any

import fitz
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import HRFlowable, PageBreak, Paragraph, SimpleDocTemplate, Spacer


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = ROOT / "config" / "current-goal-roles.json"
DEFAULT_OUT_ROOT = ROOT / "data" / "application-packages"
REFERENCE = Path(r"F:\Resume tracker\George_Jobi_Resume_Kforce.pdf")
VALIDATOR = ROOT / ".agents" / "skills" / "tailor-job-resume" / "scripts" / "validate_resume.py"
MANIFEST = ROOT / ".agents" / "skills" / "tailor-job-resume" / "scripts" / "build_package_manifest.py"
COVER_RENDERER = ROOT / ".agents" / "skills" / "tailor-job-cover-letter" / "scripts" / "render_cover_letter.py"


def register_fonts() -> tuple[str, str, str]:
    regular = Path(r"C:\Windows\Fonts\Carlito-Regular.ttf")
    bold = Path(r"C:\Windows\Fonts\Carlito-Bold.ttf")
    italic = Path(r"C:\Windows\Fonts\Carlito-Italic.ttf")
    if regular.exists() and bold.exists() and italic.exists():
        pdfmetrics.registerFont(TTFont("Carlito", str(regular)))
        pdfmetrics.registerFont(TTFont("Carlito-Bold", str(bold)))
        pdfmetrics.registerFont(TTFont("Carlito-Italic", str(italic)))
        pdfmetrics.registerFontFamily(
            "Carlito", normal="Carlito", bold="Carlito-Bold",
            italic="Carlito-Italic", boldItalic="Carlito-Bold",
        )
        return "Carlito", "Carlito-Bold", "Carlito-Italic"
    pdfmetrics.registerFontFamily(
        "Helvetica", normal="Helvetica", bold="Helvetica-Bold",
        italic="Helvetica-Oblique", boldItalic="Helvetica-BoldOblique",
    )
    return "Helvetica", "Helvetica-Bold", "Helvetica-Oblique"


def paragraph(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(text, style)


def bullet(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph("&bull; " + text, style)


def section(story: list[Any], title: str, heading: ParagraphStyle) -> None:
    story.append(paragraph(escape(title.upper()), heading))
    story.append(HRFlowable(width="100%", thickness=0.65, color=colors.HexColor("#111111"), spaceBefore=0, spaceAfter=1.7))


def styles() -> dict[str, ParagraphStyle]:
    regular, bold, italic = register_fonts()
    return {
        "name": ParagraphStyle("name", fontName=bold, fontSize=13.2, leading=14.2, alignment=TA_CENTER, spaceAfter=1.5),
        "contact": ParagraphStyle("contact", fontName=regular, fontSize=8.2, leading=9.2, alignment=TA_CENTER, spaceAfter=3.5),
        "heading": ParagraphStyle("heading", fontName=bold, fontSize=8.9, leading=9.6, alignment=TA_LEFT, spaceBefore=2.5, spaceAfter=0.2),
        "body": ParagraphStyle("body", fontName=regular, fontSize=8.0, leading=9.2, alignment=TA_LEFT, spaceAfter=0.9),
        "compact": ParagraphStyle("compact", fontName=regular, fontSize=7.8, leading=8.8, alignment=TA_LEFT, spaceAfter=0.65),
        "bullet": ParagraphStyle("bullet", fontName=regular, fontSize=7.75, leading=8.9, leftIndent=8, firstLineIndent=-6, spaceAfter=0.65),
        "compact2": ParagraphStyle("compact2", fontName=regular, fontSize=8.8, leading=10.5, alignment=TA_LEFT, spaceAfter=1.1),
        "bullet2": ParagraphStyle("bullet2", fontName=regular, fontSize=8.55, leading=10.6, leftIndent=8, firstLineIndent=-6, spaceAfter=1.5),
        "italic": ParagraphStyle("italic", fontName=italic, fontSize=7.8, leading=8.8, alignment=TA_LEFT, spaceAfter=0.65),
    }


def build_resume(role: dict[str, Any], role_dir: Path) -> Path:
    s = styles()
    out = role_dir / "George_Jobi_Resume.pdf"
    doc = SimpleDocTemplate(
        str(out), pagesize=letter, leftMargin=0.42 * inch, rightMargin=0.42 * inch,
        topMargin=0.28 * inch, bottomMargin=0.30 * inch,
    )
    hit_terms = role.get("resumeKeywords", role["keywords"][:-2])
    focus = escape(role["focus"])
    emphasis = ", ".join(escape(term) for term in hit_terms)
    story: list[Any] = [
        paragraph("GEORGE JOBI PERANGATTU", s["name"]),
        paragraph("Example City, Example State | +1 555-010-0200 | candidate@example.com | linkedin.com/in/candidate-profile", s["contact"]),
    ]

    section(story, "Professional Summary", s["heading"])
    story.append(paragraph(
        "Robotics and software engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. "
        "Hands-on experience across perception, navigation, controls, simulation, sensor fusion, data pipelines, testing, and physical-robot validation using Python, C/C++, Linux, ROS/ROS 2, Gazebo, CARLA, LiDAR, cameras, Docker, and PyTorch. "
        "Project work emphasizes reproducible evaluation, safety-minded iteration, and clear documentation across simulated and physical systems. "
        f"Role-aligned emphasis: {focus}.", s["body"]
    ))

    section(story, "Education", s["heading"])
    story.append(paragraph("<b>M.S. Robotics and Autonomous Systems (AI Concentration)</b> &nbsp; Graduating Jul 2026", s["compact"]))
    story.append(paragraph("<i>Arizona State University, Tempe, AZ</i>", s["compact"]))
    story.append(paragraph("<b>B.S. Computer Science</b> &nbsp; Graduated May 2025", s["compact"]))
    story.append(paragraph("<i>Arizona State University, Tempe, AZ</i>", s["compact"]))

    section(story, "Technical Skills", s["heading"])
    story.append(paragraph(f"<b>Role Emphasis:</b> {emphasis}", s["compact"]))
    story.append(paragraph("<b>Robotics &amp; Autonomy:</b> ROS/ROS 2, Gazebo, CARLA, URDF, Robot Navigation, Localization, Mapping, Motion Planning (RRT), Path Planning, Trajectory Optimization, Collision Avoidance, Kinematics, PID Control, Closed-Loop Control, State Estimation, Sensor Fusion", s["compact"]))
    story.append(paragraph("<b>Perception &amp; ML:</b> PyTorch, TensorFlow, Transformers, CNNs, Object Detection, Segmentation, Tracking, Pose Estimation, Depth Estimation, Point Cloud Processing, BEV Perception, LiDAR, RGB/RGB-D Cameras, Mixed-Precision Training", s["compact"]))
    story.append(paragraph("<b>Languages &amp; Platforms:</b> C/C++ (Modern), Python, C, Java, JavaScript, TypeScript, SQL, Linux/Ubuntu, Embedded-Platform Fundamentals, Docker", s["compact"]))
    story.append(paragraph("<b>Software Engineering:</b> Git, CMake, CI/CD, Testing, Verification, Validation, Debugging, GDB, Metrics, Regression Testing, Data Analysis, Documentation, Algorithms, Data Structures", s["compact"]))

    section(story, "Project Experience", s["heading"])
    story.append(paragraph("<b>Efficient TransFuser: Camera-LiDAR Sensor Fusion for Localization &amp; Perception</b> &nbsp; Spring 2026", s["compact"]))
    story.append(paragraph("<i>Arizona State University - CSE 598 Research Project</i>", s["compact"]))
    story.append(bullet("Designed a camera-LiDAR fusion pipeline for autonomous navigation, replacing TransFuser's backbone with EfficientNetV2-S to reduce parameters by <b>70% (168M to 50M)</b> while improving held-out loss by <b>8.7%</b>.", s["bullet"]))
    story.append(bullet("Built multi-scale transformer fusion over RGB images and LiDAR point clouds, improving BEV segmentation by <b>25.4%</b> across detection, segmentation, depth, mapping, and navigation tasks in CARLA.", s["bullet"]))
    story.append(bullet("Designed multi-task data-loading and training workflows spanning navigation, depth estimation, semantic segmentation, detection, and BEV mapping, using synthetic data and repeatable evaluation outputs.", s["bullet"]))
    story.append(bullet("Developed reusable PyTorch data, training, evaluation, and diagnostics pipelines; resolved an AMP focal-loss instability under FP16 GPU training using testing, metrics, and documented analysis.", s["bullet"]))
    story.append(bullet("Ran evaluations with cosine learning-rate scheduling, gradient clipping, and Kendall uncertainty weighting, organizing results for reliable comparison across perception and navigation tasks.", s["bullet"]))
    story.append(bullet("Emphasized multimodal sensing, performance diagnostics, and reproducible experiment structure while keeping the architecture and reported results traceable across training runs.", s["bullet"]))
    story.append(paragraph("<b>Parrot MiniDrone - Real-Time Localization &amp; Autonomous Control</b> &nbsp; Spring 2026", s["compact"]))
    story.append(paragraph("<i>Arizona State University - Robotics &amp; Autonomous Systems Coursework</i>", s["compact"]))
    story.append(bullet("Implemented closed-loop PID control for yaw, velocity, and altitude with inertial/visual sensor fusion for real-time state estimation and navigation on physical hardware.", s["bullet"]))
    story.append(bullet("Built automated test sequences, logged sensor data, measured navigation performance, and engineered safety checks and failsafes across simulation and real-world validation.", s["bullet"]))
    story.append(bullet("Iteratively debugged sensor, control, and timing behavior under real-time constraints while documenting performance changes on the physical platform.", s["bullet"]))
    story.append(bullet("Compared simulation and physical-flight behavior to isolate localization and control differences before repeating hardware tests.", s["bullet"]))
    story.append(bullet("Produced repeatable sensor logs and performance summaries covering positioning, yaw response, altitude behavior, and safety-trigger outcomes.", s["bullet"]))

    story.append(PageBreak())
    section(story, "Project Experience (Continued)", s["heading"])
    story.append(paragraph("<b>3D Motion Planning for Autonomous Navigation in Gazebo</b> &nbsp; Fall 2025", s["compact2"]))
    story.append(paragraph("<i>Arizona State University - Robotics &amp; Autonomous Systems Coursework</i>", s["compact2"]))
    story.append(bullet("Developed Python 3D RRT planning for collision-free trajectories, integrated with ROS and Gazebo, and evaluated path quality across multiple environment configurations.", s["bullet2"]))
    story.append(bullet("Applied path post-processing to improve trajectory quality for downstream robot control and documented repeatable simulation-validation results.", s["bullet2"]))
    story.append(bullet("Designed repeatable experiment configurations and used trajectory behavior and collision outcomes to validate planner performance.", s["bullet2"]))
    story.append(paragraph("<b>Spider CAD Robot - Multi-Legged Robot Design (In Progress)</b> &nbsp; Spring 2026", s["compact2"]))
    story.append(paragraph("<i>Arizona State University - Robotics &amp; Autonomous Systems Coursework</i>", s["compact2"]))
    story.append(bullet("Designing a multi-legged robot in CAD with constrained joints, validating kinematics and actuator placement, and preparing a URDF-exportable model for ROS/Gazebo controls experiments.", s["bullet2"]))
    story.append(bullet("Structured the model for downstream simulation experiments involving joint limits, actuator behavior, navigation, and closed-loop control.", s["bullet2"]))
    story.append(paragraph("<b>Complementarity-Free Dexterous Manipulation with TacDrones</b> &nbsp; Jun 2026 - Expected Dec 2026", s["compact2"]))
    story.append(paragraph("<i>Arizona State University - Applied Project</i>", s["compact2"]))
    story.append(bullet("Developing the low-level flight-control interface for three TacDrones acting as aerial fingertips in a complementarity-free MPC manipulation stack, connecting object trajectories to per-drone position, altitude, attitude, and yaw references.", s["bullet2"]))
    story.append(bullet("Implemented a yaw-aware outer position-control layer and am integrating MuJoCo simulation, safety checks, trajectory tracking, state feedback, and contact-planning concepts for aerial manipulation experiments.", s["bullet2"]))
    story.append(bullet("Refactored interfaces between high-level object motion and per-drone position, altitude, attitude, and yaw commands to support repeatable three-agent simulation experiments.", s["bullet2"]))

    section(story, "Work Experience", s["heading"])
    story.append(paragraph("<b>Backend Developer Intern - DigiClips Media</b> &nbsp; Aug 2024 - May 2025", s["compact2"]))
    story.append(paragraph("<i>Tempe, AZ</i>", s["compact2"]))
    story.append(bullet("Developed Python/PyTorch ML models and data pipelines handling <b>10M+ daily queries</b>, reducing latency by <b>45%</b> through profiling, reusable code, and data-driven optimization.", s["bullet2"]))
    story.append(bullet("Improved computer-vision detection accuracy by <b>30%</b> through model evaluation, debugging, and collaboration on production-oriented image-recognition workflows.", s["bullet2"]))
    story.append(paragraph("<b>Full Stack Developer Intern - Odoo</b> &nbsp; May 2025 - Aug 2025", s["compact2"]))
    story.append(paragraph("<i>Dubai, UAE</i>", s["compact2"]))
    story.append(bullet("Refactored Python backend systems for production applications and collaborated on system design, validation, documentation, and deployment-oriented engineering work.", s["bullet2"]))
    story.append(bullet("Worked across production code paths with multidisciplinary teammates while maintaining clear implementation notes and reusable backend components.", s["bullet2"]))
    story.append(paragraph("<b>Full Stack Developer Intern - TicketDex</b> &nbsp; Jan 2025 - May 2025", s["compact2"]))
    story.append(paragraph("<i>Tempe, AZ</i>", s["compact2"]))
    story.append(bullet("Delivered backend services and testing infrastructure, reducing latency by <b>30%</b> through algorithmic optimization, database refactoring, and cross-functional evaluation.", s["bullet2"]))
    story.append(bullet("Added tests and iterated on service behavior with teammates to keep performance changes measurable and maintainable.", s["bullet2"]))
    doc.build(story)
    return out


def responses_for(role: dict[str, Any]) -> dict[str, Any]:
    personal_statement = (
        "I am finishing my M.S. in Robotics and Autonomous Systems at Arizona State University, "
        "and I have been building the kind of practical robotics experience this role needs: "
        "camera-LiDAR perception work, ROS/Gazebo motion planning, PID control and sensor fusion "
        "on a physical MiniDrone, and careful testing across simulation and hardware. I am strongest "
        "when I can connect algorithms, software interfaces, logs, and real system behavior, then "
        "turn that into something reproducible and well documented."
    )
    why_company = (
        f"I am interested in {role['company']} because the {role['role']} role is close to the work I "
        f"have been trying to grow into: {role['focus']}. I can contribute with Python, C++, Linux, "
        "robotics testing, sensor data, simulation, and a habit of debugging from evidence instead of "
        "guesswork."
    )
    common = {
        "full_name": "George Jobi Perangattu",
        "email": "candidate@example.com",
        "phone": "+1 555-010-0200",
        "current_location": "Tempe, Arizona",
        "address": "Example City, Example State",
        "linkedin": "https://www.linkedin.com/in/candidate-profile/",
        "current_organization": "Arizona State University / graduate student",
        "work_authorized_now": "Yes",
        "requires_sponsorship_now": "No, based on current OPT eligibility",
        "requires_sponsorship_now_or_future": "Yes",
        "eligible_for_opt": "Yes",
        "stem_opt_eligible": "Yes",
        "willing_to_relocate": "Yes, anywhere in the United States",
        "earliest_start": "Two weeks",
        "willing_to_undergo_background_check": "Yes",
        "salary_expectation_rule": (
            "Use the midpoint of the job description's published base-salary range, rounded sensibly to "
            "the nearest $1,000. If no numeric range is published and a number is required, use a "
            "market-competitive figure for the role, level, and location and record the exact figure used."
        ),
        "race_if_requested": "Asian (or South Asian when that exact option exists)",
        "disability_status": "No, I don't have a disability and have not had one in the past.",
        "gender_if_requested": "Male",
        "veteran_status": "Not a veteran; did not serve in the military",
        "other_voluntary_demographics": "Leave sexual orientation, transgender status, and other unconfirmed voluntary demographics unanswered or decline when required",
        "source": "Company website / internet search",
        "resume_filename": "George_Jobi_Resume.pdf",
        "cover_letter_filename": "George_Jobi_CoverLetter.pdf",
        "personal_statement": personal_statement,
        "additional_information": personal_statement,
        "why_company": why_company,
        "why_role": why_company,
        "coverLetterText": personal_statement,
        "whyCompany": why_company,
    }
    custom: dict[str, Any] = {}
    slug = role["slug"]
    if slug in {"skydio-autonomy-software-engineer", "skydio-simulation-robotics-engineer"}:
        custom = {
            "how_found": "Company website / internet search",
            "prior_us_government_employment": "Leave unanswered if optional; not confirmed",
            "gender": "Male",
            "race": "Asian",
            "hispanic_latino": "Leave unanswered or decline; not confirmed",
            "veteran_status": "Not a veteran; did not serve in the military",
            "disability_status": "No, I don't have a disability and have not had one in the past",
        }
    elif slug == "gotion-junior-controls-engineer":
        custom = {
            "salary_expectation": "$65,000 if a numeric salary field is presented",
            "cover_letter": "Upload George_Jobi_CoverLetter.pdf in the optional cover-letter field",
            "controls_experience_note": (
                "Academic robotics experience includes PID control, sensor fusion, actuator behavior, "
                "automated tests, and physical-hardware troubleshooting; do not claim direct PLC or HMI ownership."
            ),
        }
    elif slug == "simbe-robotics-robot-software-qa-test-engineer":
        custom = {
            "currently_in_san_francisco_bay_area": "No",
            "authorized_in_us": "Yes",
            "now_or_future_sponsorship": "Yes",
            "salary_expectation": "$100,000",
        }
    elif slug == "bedrock-robotics-field-test-specialist":
        custom = {
            "authorized_in_us": "Yes",
            "future_sponsorship": "Yes",
            "phone": "+1 555-010-0200",
            "linkedin_profile": "https://www.linkedin.com/in/candidate-profile/",
            "cover_letter": "No cover-letter or permitted supporting-document field is present on the live Ashby form",
        }
    elif slug == "cyngn-robotics-integration-engineer":
        custom = {
            "requires_immigration_support": "Yes",
            "favorite_programming_languages": "Python, C++, and C",
            "why_great_fit": (
                "I combine robotics graduate study with hands-on autonomy, perception, controls, and "
                "physical-hardware validation. My Efficient TransFuser project built a camera-LiDAR "
                "perception and localization pipeline and reduced model parameters by 70% while improving "
                "held-out loss and BEV segmentation. On a physical Parrot MiniDrone, I implemented PID "
                "control, localization, sensor fusion, logging, automated tests, and safety checks. I also "
                "developed Python RRT motion planning with ROS and Gazebo. Those projects align with Cyngn's "
                "need for C++/Python, Linux, ROS 2, sensor integration, diagnostics, simulation, and reliable "
                "autonomous-vehicle validation. My software internships add experience with production-oriented "
                "Python services, testing, data pipelines, performance analysis, and clear documentation."
            ),
        }
    elif slug in {
        "may-mobility-ml-engineer-ii-autonomy-infrastructure",
        "may-mobility-robotics-engineer-ii",
        "may-mobility-autonomy-release-engineer-ii",
    }:
        custom = {
            "authorized_in_us": "Yes",
            "future_sponsorship": "Yes",
            "gender_identity": "Male when the field is asking gender; leave unanswered or decline if it asks broader identity not recorded in candidate answers",
            "race_ethnicity": "Asian",
            "sexual_orientation": "Leave unanswered or decline; not confirmed",
            "transgender_status": "Leave unanswered or decline; not confirmed",
            "disability_or_chronic_condition": "Leave unanswered or decline; chronic-condition status is not confirmed",
            "veteran_or_armed_forces": "Not a veteran; did not serve in the military",
            "federal_gender": "Male",
            "hispanic_latino": "Leave unanswered or decline; not confirmed",
            "federal_veteran_status": "Not a veteran / I am not a protected veteran",
            "federal_disability_status": "No, I don't have a disability and have not had one in the past",
        }
    elif slug == "agility-robotics-software-engineer-ii":
        custom = {
            "willing_to_relocate": "Yes",
            "future_sponsorship": "Yes",
            "authorized_in_us": "Yes",
            "gender": "Male",
            "race": "Asian",
            "veteran_status": "Not a veteran; did not serve in the military",
            "disability_status": "No, I don't have a disability and have not had one in the past",
        }
    elif slug == "physical-intelligence-controls-engineer":
        custom = {
            "github_or_website": "Leave blank; no confirmed GitHub or portfolio URL",
            "why_physical_intelligence": (
                "Physical Intelligence's work connects model-based control, real-time robotics, and learned "
                "policies on complex physical systems. That is a strong match for my M.S. work in robotics "
                "and autonomous systems and for the way I approach engineering: develop in simulation, measure "
                "behavior, then validate carefully on hardware. My MiniDrone project combined PID control, "
                "localization, sensor fusion, logging, safety checks, and repeatable physical tests, while my "
                "motion-planning and TacDrone work connects trajectory generation, control interfaces, and "
                "multi-agent simulation. I am especially interested in helping make learned robot behaviors "
                "predictable and safe through strong controls, instrumentation, and disciplined debugging."
            ),
            "extraordinary_accomplishments": (
                "In my Efficient TransFuser research project, I replaced a 168M-parameter backbone with a "
                "50M-parameter EfficientNetV2-S design, a 70% reduction, while improving held-out loss by "
                "8.7% and BEV segmentation by 25.4%. I built the multimodal camera-LiDAR training and "
                "evaluation workflow and resolved a mixed-precision focal-loss instability through testing, "
                "metrics, and documented analysis. I also implemented closed-loop PID control, localization, "
                "sensor fusion, automated test sequences, and safety checks on a physical Parrot MiniDrone, "
                "then compared simulation and flight behavior to isolate timing and control differences."
            ),
        }
    elif slug == "pickle-robot-robotics-software-engineer-ml-grasping":
        custom = {
            "currently_in_greater_boston_and_onsite_three_days": "No",
            "work_authorized_now": "Yes",
            "future_sponsorship": "Yes, sponsorship or visa transfer required in the future",
            "salary_expectation": "$123,000",
            "earliest_start": "Two weeks",
            "race": "Asian",
            "pronouns_gender_veteran": "Gender: Male. Veteran status: not a veteran / did not serve in the military. Leave pronouns unanswered or decline if separate and optional.",
            "cover_letter": "No cover-letter or permitted supporting-document field is present on the live Lever form",
        }
    elif slug.startswith("tycho-ai-"):
        custom = {
            "currently_in_boston_area": "No",
            "future_sponsorship": "Yes",
            "cxx_experience": "Yes, in an academic role",
            "recent_cxx_project": (
                "My recent 3D motion-planning coursework developed collision-free RRT planning and ROS/Gazebo "
                "integration; the core planner was implemented primarily in Python. My C++ experience is "
                "academic rather than professional and includes working in CMake- and ROS-based robotics "
                "environments. I do not want to overstate this as a recent production C++ deployment."
            ),
        }
        if slug == "tycho-ai-software-engineer":
            custom.update({
                "robotics_experience": "Yes, in an academic role",
                "robotics_project_stack": (
                    "On a physical Parrot MiniDrone, I implemented localization, inertial/visual sensor fusion, "
                    "closed-loop PID control, sensor logging, automated tests, and safety checks. I also built "
                    "Python RRT motion planning integrated with ROS and Gazebo and evaluated collision-free "
                    "trajectories across repeatable simulation configurations."
                ),
            })
    elif slug in {"nimble-robotics-field-engineer-nj", "multiply-labs-robotics-field-engineer"}:
        custom = {
            "cover_letter": "Upload George_Jobi_CoverLetter.pdf wherever the form offers a cover-letter field",
        }
    elif slug == "weride-application-engineer":
        custom = {
            "gender": "Male",
            "race": "Asian",
            "veteran_status": "Not a veteran; did not serve in the military",
            "future_opportunity_consent": "Leave unchecked",
        }
    elif slug == "medra-robotics-software-engineer":
        custom = {"authorized_in_us": "Yes", "future_sponsorship": "Yes", "in_office_five_days": "Yes"}
    elif slug == "allen-controls-cv-ml-junior":
        custom = {"now_or_future_sponsorship": "Yes", "austin_onsite_or_relocate": "Yes"}
    elif slug in {"allen-controls-robotics-motion", "allen-controls-mission-systems-integration"}:
        custom = {"authorized_without_sponsorship_now_or_future": "No", "austin_onsite_or_relocate": "Yes, willing to relocate"}
    elif slug == "venti-autonomous-vehicle-validation-engineer":
        custom = {"earliest_joining_date": "Two weeks", "now_or_future_sponsorship": "Yes", "preferred_location": "California"}
    elif slug.startswith("picknik-"):
        custom = {"authorized_in_us": "Yes", "boulder_denver_or_relocate": "Yes, willing to relocate", "travel_under_20_percent": "Compatible with posting"}
    elif slug.startswith("tutor-intelligence-"):
        custom = {"legally_authorized": "Yes", "future_sponsorship": "Yes", "watertown_commute": "Yes, willing to relocate and commute"}
        if slug == "tutor-intelligence-research-engineer":
            custom["hardest_technical_challenges"] = (
                "Making general-purpose robots reliable across changing factory objects and conditions: "
                "learning manipulation behaviors from limited real-world data, detecting failures, and closing "
                "the loop between deployment telemetry, perception, motion planning, and rapid model updates "
                "without introducing unsafe regressions."
            )
    elif slug.startswith("fieldai-"):
        custom = {"legally_authorized": "Yes", "future_sponsorship": "Yes", "age_18_or_older": "Yes (previously user-confirmed)", "certification": "I certify and agree", "future_opportunity_consent": "Leave unchecked (optional)"}
    elif slug == "xdof-forward-deployed-engineer":
        custom = {"visa_sponsorship": "Yes. Currently authorized through OPT; future employer sponsorship such as H-1B will be required."}
    elif slug == "eventual-software-engineer-new-grad":
        custom = {
            "why_eventual": (
                "Eventual is working on a bottleneck I have encountered directly in robotics: turning large, "
                "multimodal sensor datasets into reliable experiments and usable engineering feedback. In my "
                "Efficient TransFuser project, I built a camera-LiDAR training and evaluation workflow, reduced "
                "the model from 168M to 50M parameters, and improved held-out loss and BEV segmentation while "
                "debugging a mixed-precision instability. That experience made me care deeply about the data, "
                "systems, and performance layers behind physical AI. Eventual's focus on video-native and "
                "multimodal infrastructure is therefore a strong match for both my robotics background and my "
                "software-engineering experience with Python services, testing, data pipelines, and performance "
                "analysis. I am especially excited by the chance to contribute to infrastructure that makes "
                "robotics researchers iterate faster and more reproducibly."
            ),
            "most_recent_school": "Arizona State University",
        }
    elif slug == "lila-contractor-robotics-engineer":
        custom = {
            "future_sponsorship": "Yes",
            "currently_resides_in_continental_us": "Yes",
            "specified_location_or_relocate": "Yes",
            "why_lila_role_now": (
                "Lila's closed-loop approach to autonomous science is compelling because it makes robotics a "
                "critical part of the scientific workflow, not a standalone demo. This role matches the way I "
                "like to work: connecting ROS 2 software, simulation, motion planning, sensor feedback, and "
                "physical-hardware validation until a system behaves reliably. My graduate robotics work includes "
                "Python RRT planning with ROS and Gazebo, PID control and sensor fusion on a physical MiniDrone, "
                "and current low-level control infrastructure for multi-agent TacDrone manipulation. As I complete "
                "my M.S. in Robotics and Autonomous Systems, I am looking for a hands-on environment where careful "
                "debugging and deployment can unblock meaningful downstream work. The opportunity to help the AI "
                "Science Factory move samples and instruments reliably is exactly that kind of concrete, "
                "high-impact systems challenge."
            ),
            "privacy_notice": "Acknowledge",
        }
    return {"common": common, "role_specific": custom, "unresolved": []}


def build_cover_letter(role: dict[str, Any], role_dir: Path) -> tuple[Path, Path, Path]:
    body = role_dir / "cover-letter-body.txt"
    body.write_text(
        (
            f"I am applying for the {role['role']} position at {role['company']}. "
            f"What stands out to me is the role's focus on {role['focus']}. That is close to the kind of work I have been doing at Arizona State University while finishing my M.S. in Robotics and Autonomous Systems.\n\n"
            "My strongest robotics work has been practical and test-driven. In Efficient TransFuser, I built and evaluated a camera-LiDAR perception and localization pipeline for autonomous navigation. I replaced the original backbone with EfficientNetV2-S, reducing parameters from 168 million to 50 million while improving held-out loss by 8.7 percent and BEV segmentation by 25.4 percent. The project forced me to be careful with data, debugging, repeatable evaluation, and performance tradeoffs rather than just model results.\n\n"
            "I have also worked closer to hardware: closed-loop PID control, localization, sensor fusion, logging, automated test sequences, and safety checks on a physical Parrot MiniDrone. In another project, I used Python RRT with ROS and Gazebo to plan and evaluate collision-free trajectories. Those projects made me comfortable moving between simulation, sensor data, software interfaces, and real system behavior.\n\n"
            f"I am early in my full-time career, but I bring a useful mix of robotics coursework, software internships, Python/C++ experience, and patience with testing messy systems. I would be glad to bring that to {role['company']} and learn from the team working on the {role['role']} role."
        ),
        encoding="utf-8",
    )
    pdf = role_dir / "George_Jobi_CoverLetter.pdf"
    report = role_dir / "cover-letter-validation.json"
    subprocess.run([
        sys.executable, str(COVER_RENDERER), "--company", role["company"],
        "--role", role["role"], "--body-file", str(body), "--out", str(pdf),
        "--report", str(report),
    ], check=True, stdout=subprocess.DEVNULL)
    return pdf, report, role_dir / "cover-letter-preview-page-1.png"


def write_supporting_files(role: dict[str, Any], role_dir: Path) -> Path:
    (role_dir / "ats-keywords.txt").write_text("\n".join(role["keywords"]) + "\n", encoding="utf-8")
    (role_dir / "job-description.txt").write_text(
        f"Role: {role['role']}\nCompany: {role['company']}\nLocation: {role['location']}\n"
        f"Authoritative listing: {role['jobUrl']}\nApplication: {role['applyUrl']}\n\n"
        f"Screened role focus:\n{role['focus']}\n\n"
        "Relevant posting terms used for the local alignment review:\n- " + "\n- ".join(role["keywords"]) + "\n",
        encoding="utf-8",
    )
    gaps = {
        "company": role["company"], "role": role["role"],
        "truthful_strengths": role["keywords"][:-2], "reported_gaps": role["gaps"],
        "note": "The resume does not claim the reported gaps. The ATS figure is a local phrase-coverage heuristic, not an employer score.",
    }
    (role_dir / "keyword-gap-analysis.json").write_text(json.dumps(gaps, indent=2) + "\n", encoding="utf-8")
    responses = role_dir / "application-responses.json"
    responses.write_text(json.dumps(responses_for(role), indent=2) + "\n", encoding="utf-8")
    return responses


def render_pages(pdf: Path) -> list[Path]:
    doc = fitz.open(pdf)
    outputs: list[Path] = []
    for index, page in enumerate(doc, 1):
        pix = page.get_pixmap(matrix=fitz.Matrix(1.7, 1.7), alpha=False)
        out = pdf.parent / f"resume-preview-page-{index}.png"
        pix.save(out)
        outputs.append(out)
    doc.close()
    return outputs


def run_validation_and_manifest(
    role: dict[str, Any], role_dir: Path, pdf: Path, responses: Path,
    cover_letter: Path, cover_validation: Path,
) -> dict[str, Any]:
    validation = role_dir / "validation-report.json"
    subprocess.run([
        sys.executable, str(VALIDATOR), "--pdf", str(pdf), "--keywords", str(role_dir / "ats-keywords.txt"),
        "--reference", str(REFERENCE), "--json-out", str(validation),
    ], check=True, stdout=subprocess.DEVNULL)
    manifest = role_dir / "approval-manifest.json"
    subprocess.run([
        sys.executable, str(MANIFEST), "--company", role["company"], "--role", role["role"],
        "--job-url", role["jobUrl"], "--resume", str(pdf), "--validation", str(validation),
        "--cover-letter", str(cover_letter), "--cover-validation", str(cover_validation),
        "--response", str(responses), "--out", str(manifest),
    ], check=True, stdout=subprocess.DEVNULL)
    report = json.loads(validation.read_text(encoding="utf-8"))
    return {"validation": str(validation), "manifest": str(manifest), "ats": report["keywordCoverage"]}


def build_contact_sheets(records: list[dict[str, Any]], out_root: Path) -> list[str]:
    outputs: list[str] = []
    try:
        font = ImageFont.truetype(r"C:\Windows\Fonts\arial.ttf", 20)
    except OSError:
        font = ImageFont.load_default()
    for sheet_index in range(0, len(records), 5):
        group = records[sheet_index:sheet_index + 5]
        canvas = Image.new("RGB", (1260, 4050), "white")
        draw = ImageDraw.Draw(canvas)
        for row, record in enumerate(group):
            y = row * 810
            label = f"{sheet_index + row + 1}. {record['company']} — {record['role']}"
            draw.text((12, y + 4), label, fill="black", font=font)
            for col, page_path in enumerate(record["previews"]):
                image = Image.open(page_path).convert("RGB")
                image.thumbnail((600, 760))
                canvas.paste(image, (12 + col * 620, y + 42))
        out = out_root / f"resume-review-contact-sheet-{sheet_index // 5 + 1}.png"
        canvas.save(out)
        outputs.append(str(out))
    return outputs


def build_cover_contact_sheets(records: list[dict[str, Any]], out_root: Path) -> list[str]:
    outputs: list[str] = []
    try:
        font = ImageFont.truetype(r"C:\Windows\Fonts\arial.ttf", 20)
    except OSError:
        font = ImageFont.load_default()
    for sheet_index in range(0, len(records), 5):
        group = records[sheet_index:sheet_index + 5]
        canvas = Image.new("RGB", (1260, 4050), "white")
        draw = ImageDraw.Draw(canvas)
        for row, record in enumerate(group):
            y = row * 810
            label = f"{sheet_index + row + 1}. {record['company']} - {record['role']}"
            draw.text((12, y + 4), label, fill="black", font=font)
            preview = Image.open(record["coverPreview"]).convert("RGB")
            preview.thumbnail((600, 760))
            canvas.paste(preview, (330, y + 42))
        out = out_root / f"cover-letter-review-contact-sheet-{sheet_index // 5 + 1}.png"
        canvas.save(out)
        outputs.append(str(out))
    return outputs


def main() -> int:
    parser = argparse.ArgumentParser(description="Build validated application packages for the current goal roles.")
    parser.add_argument(
        "--slug",
        action="append",
        dest="slugs",
        help="Build only this role slug; repeat for multiple replacements. The package index is merged in config order.",
    )
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--out-root", type=Path, default=DEFAULT_OUT_ROOT)
    args = parser.parse_args()
    config_path = args.config.expanduser().resolve()
    out_root = args.out_root.expanduser().resolve()
    data = json.loads(config_path.read_text(encoding="utf-8"))
    all_roles = data["roles"]
    if len(all_roles) < 15:
        raise ValueError(f"Expected at least 15 roles, found {len(all_roles)}")
    requested_slugs = set(args.slugs or [])
    known_slugs = {role["slug"] for role in all_roles}
    unknown_slugs = sorted(requested_slugs - known_slugs)
    if unknown_slugs:
        raise ValueError(f"Unknown role slug(s): {', '.join(unknown_slugs)}")
    roles = [role for role in all_roles if not requested_slugs or role["slug"] in requested_slugs]
    out_root.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, Any]] = []
    for role in roles:
        role_dir = out_root / role["slug"]
        role_dir.mkdir(parents=True, exist_ok=True)
        responses = write_supporting_files(role, role_dir)
        pdf = build_resume(role, role_dir)
        previews = render_pages(pdf)
        cover_letter, cover_validation, cover_preview = build_cover_letter(role, role_dir)
        checked = run_validation_and_manifest(
            role, role_dir, pdf, responses, cover_letter, cover_validation,
        )
        records.append({
            "slug": role["slug"], "company": role["company"], "role": role["role"],
            "provider": role["provider"], "location": role["location"], "jobUrl": role["jobUrl"],
            "applyUrl": role["applyUrl"], "resume": str(pdf), "previews": [str(x) for x in previews],
            "coverLetter": str(cover_letter), "coverValidation": str(cover_validation),
            "coverPreview": str(cover_preview),
            **checked,
        })
    if requested_slugs:
        index = out_root / "package-index.json"
        existing_records: dict[str, dict[str, Any]] = {}
        if index.exists():
            existing_payload = json.loads(index.read_text(encoding="utf-8"))
            existing_records = {record["slug"]: record for record in existing_payload.get("records", [])}
        rebuilt_records = {record["slug"]: record for record in records}
        merged_records: list[dict[str, Any]] = []
        for role in all_roles:
            record = rebuilt_records.get(role["slug"]) or existing_records.get(role["slug"])
            if record is None:
                raise ValueError(f"No package-index record available for {role['slug']}")
            merged_records.append(record)
        records = merged_records
    sheets = build_contact_sheets(records, out_root)
    cover_sheets = build_cover_contact_sheets(records, out_root)
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(), "count": len(records),
        "records": records, "contactSheets": sheets, "coverContactSheets": cover_sheets,
        "packageIndexSha256": None,
    }
    index = out_root / "package-index.json"
    encoded = json.dumps(payload, indent=2) + "\n"
    index.write_text(encoded, encoding="utf-8")
    payload["packageIndexSha256"] = hashlib.sha256(encoded.encode("utf-8")).hexdigest()
    index.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "count": len(records), "index": str(index), "contactSheets": sheets,
        "coverContactSheets": cover_sheets,
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
