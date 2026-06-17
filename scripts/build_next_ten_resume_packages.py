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
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import HRFlowable, PageBreak, Paragraph, SimpleDocTemplate
from reportlab.lib.styles import ParagraphStyle


ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = ROOT / "data" / "next-ten-applications"
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

COMMON_CONFIRM = [
    "phone number",
    "LinkedIn URL",
    "current location/city",
    "current company answer",
    "work authorization and future sponsorship answers",
]

ROLES: list[dict[str, Any]] = [
    {
        "folder": "fieldai-ros-developer",
        "company": "Field AI",
        "role": "Software Engineer, ROS Developer",
        "location": "Irvine, CA",
        "url": "https://jobs.lever.co/field-ai/c3650d39-20eb-454e-97f8-4d38494e0fe6/apply",
        "listingUrl": "https://jobs.lever.co/field-ai/c3650d39-20eb-454e-97f8-4d38494e0fe6",
        "summary": "Robotics Software Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Hands-on experience building ROS/ROS 2-adjacent autonomous robotics software, localization and navigation algorithms, sensor fusion workflows, real-time control, and robotics validation using Python, C/C++, Linux, Gazebo, CARLA, LiDAR, cameras, and IMU-style sensor data. Strong fit for production-grade autonomy work involving ROS packages, SLAM, state estimation, sensor integration, diagnostics, and field-ready robotic systems.",
        "skills_add": "Role Emphasis: ROS Developer, ROS/ROS2 Packages, Autonomy APIs, Perception, Localization, SLAM, Navigation, Control Modules, Sensor Integration, LiDAR, RGB Cameras, GPS/IMU Concepts, Real-Time Data Processing, Diagnostics, Field Robotics",
        "project_edits": {1: "Emphasized physical robot bring-up, sensor fusion, PID control, diagnostics, and recovery-minded validation for real-world robot behavior.", 2: "Emphasized ROS/Gazebo navigation validation, path planning, and modular autonomy software."},
        "keywords": ["ROS", "ROS2", "C++", "Python", "perception", "localization", "SLAM", "sensor fusion", "navigation", "control", "LiDAR", "RGB", "GPS", "IMU", "real-time", "diagnostics", "Linux", "autonomy", "field robotics", "state estimation", "path planning", "middleware"],
        "target": 93,
        "confirm": [*COMMON_CONFIRM, "onsite/hybrid willingness for Irvine, CA", "start date", "OPT status", "STEM OPT eligibility", "Python/C++ proficiency level"],
        "gap": "Reach items: production ROS package ownership and field deployment depth. Resume truthfully emphasizes ROS/Gazebo, real hardware control, sensor fusion, diagnostics, and Python/C++ robotics software.",
    },
    {
        "folder": "fieldai-robot-integrations",
        "company": "Field AI",
        "role": "Robotics Software Engineer - Robot Integrations",
        "location": "Irvine, CA",
        "url": "https://jobs.lever.co/field-ai/b5f58151-9a46-441f-badf-2e91244bfd39/apply",
        "listingUrl": "https://jobs.lever.co/field-ai/b5f58151-9a46-441f-badf-2e91244bfd39",
        "summary": "Robotics Software Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Hands-on experience integrating sensors, controls, state estimation, navigation, and autonomous robotics software across real and simulated platforms using Python, C/C++, Linux, ROS/ROS 2 concepts, Gazebo, CARLA, LiDAR, cameras, and actuator-aware control workflows. Strong fit for robot integration work involving drivers, diagnostics, calibration, timing, sensing, actuation, and hardware-software debugging.",
        "skills_add": "Role Emphasis: Robot Integrations, Robot Bring-Up, Robot Drivers, Sensing Interfaces, State Interfaces, Actuation Interfaces, Calibration, Timing, Diagnostics, Control Paths, Networking Concepts, Hardware-Software Debugging, ROS/ROS2",
        "project_edits": {1: "Emphasized real hardware operation, sensor logging, safety checks, and hardware-software debugging on a physical robot.", 4: "Emphasized upcoming sensor, actuator, PLC/control-logic, and industrial automation integration work."},
        "keywords": ["robot integrations", "drivers", "sensing", "state estimation", "actuation", "control", "calibration", "timing", "diagnostics", "ROS", "ROS2", "C++", "Python", "Linux", "hardware", "software", "networking", "sensors", "actuators", "robot bring-up"],
        "target": 92,
        "confirm": [*COMMON_CONFIRM, "onsite willingness for Irvine, CA", "start date", "OPT status", "STEM OPT eligibility"],
        "gap": "Reach items: direct vendor SDK and production robot bring-up ownership. Resume emphasizes truthful real-hardware controls, sensor interfaces, safety checks, diagnostics, and ROS/Gazebo integration.",
    },
    {
        "folder": "simbe-robotics-software-engineer",
        "company": "Simbe Robotics",
        "role": "Robotics Software Engineer (C++ & Python)",
        "location": "San Francisco Bay Area",
        "url": "https://jobs.lever.co/SimbeRobotics/bffe760d-b1fb-49ff-b259-f0724c8661fa/apply",
        "listingUrl": "https://jobs.lever.co/SimbeRobotics/bffe760d-b1fb-49ff-b259-f0724c8661fa",
        "summary": "Robotics Software Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Hands-on experience with C/C++, Python, ROS/ROS 2 concepts, localization, perception, sensor fusion, autonomous navigation, Gazebo simulation, CARLA perception research, and physical robot PID control. Strong fit for mobile robotics software involving ROS1/ROS2, C++/Python, navigation, perception, mapping, real-time validation, and production-minded software practices.",
        "skills_add": "Role Emphasis: Mobile Robotics, ROS1/ROS2, C++ Robotics Software, Python Robotics Software, Navigation Stack, Perception, Mapping, Localization, Sensor Fusion, Robot Validation, Real-Time Control, Production Robotics",
        "project_edits": {1: "Emphasized ROS-relevant real-hardware controls and sensor fusion contributions for a physical robot.", 2: "Emphasized ROS/Gazebo motion-planning implementation and validation."},
        "keywords": ["C++", "Python", "ROS1", "ROS2", "mobile robotics", "navigation", "mapping", "localization", "perception", "sensor fusion", "real-time", "Gazebo", "Linux", "robotics software", "controls", "SLAM", "state estimation"],
        "target": 93,
        "confirm": [*COMMON_CONFIRM, "Bay Area relocation/hybrid willingness", "salary expectation number", "substantive ROS1/ROS2 experience answer", "work authorization and sponsorship answers"],
        "gap": "Reach items: professional ROS1/ROS2 production experience. Resume emphasizes truthful coursework/research ROS/Gazebo, physical drone controls, C++/Python, localization, and perception software.",
    },
    {
        "folder": "orchard-perception-localization",
        "company": "Orchard Robotics",
        "role": "Robotics Software Engineer (Perception & Localization)",
        "location": "San Francisco, CA / Seattle, WA",
        "url": "https://jobs.ashbyhq.com/orchard/4f81b000-c82a-4285-b05d-a7861a576d6f/application",
        "listingUrl": "https://jobs.ashbyhq.com/orchard/4f81b000-c82a-4285-b05d-a7861a576d6f",
        "summary": "Robotics Software Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Hands-on experience developing perception and localization algorithms using camera-LiDAR sensor fusion, computer vision, depth estimation, pose estimation, mapping, navigation, Python, C/C++, PyTorch, CARLA, Gazebo, and ROS/ROS 2 concepts. Strong fit for ag-tech robotics software involving edge perception, stereo/depth cues, localization, sensor calibration, and real-world validation.",
        "skills_add": "Role Emphasis: Perception & Localization, Computer Vision, Stereo/Depth Estimation, Camera-LiDAR Fusion, Sensor Calibration Concepts, Edge Robotics, GNSS Concepts, Mapping, Pose Estimation, PyTorch, C++/Python",
        "project_edits": {0: "Emphasized camera-LiDAR perception, depth estimation, pose estimation, BEV mapping, and localization outputs for field robotics.", 1: "Emphasized visual/inertial sensor fusion and physical robot validation."},
        "keywords": ["perception", "localization", "computer vision", "stereo", "depth estimation", "pose estimation", "mapping", "camera", "LiDAR", "sensor fusion", "calibration", "edge", "GNSS", "Python", "C++", "PyTorch", "robotics software"],
        "target": 94,
        "confirm": [*COMMON_CONFIRM, "answer to 'exceptional work'", "answer to ag-tech motivation", "favorite fruit anti-bot answer", "start timeline", "relocation/commute willingness"],
        "gap": "Reach items: direct orchard/ag-tech deployment and GNSS specifics. Resume emphasizes truthful perception/localization, sensor fusion, depth, mapping, and physical robot validation.",
    },
    {
        "folder": "gritt-robotics-software-engineer",
        "company": "Gritt Robotics",
        "role": "Robotics Software Engineer",
        "location": "Belmont, CA",
        "url": "https://jobs.ashbyhq.com/gritt/731460ed-b7a1-4912-b32a-6dc05744a5a0/application",
        "listingUrl": "https://jobs.ashbyhq.com/gritt/731460ed-b7a1-4912-b32a-6dc05744a5a0",
        "summary": "Robotics Software Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Hands-on experience building simulation-backed robotics perception and autonomy workflows using Python, C/C++, PyTorch, CARLA, Gazebo, camera-LiDAR data, sensor fusion, localization, navigation, and controls. Strong fit for robotics infrastructure involving simulation, training and validation pipelines, multimodal datasets, GPU-accelerated ML workflows, robot learning concepts, and robust software engineering.",
        "skills_add": "Role Emphasis: Simulation Infrastructure, Training Infrastructure, Robot AI Models, Multimodal Datasets, Cameras, LiDAR, PyTorch, GPU Workflows, Validation Pipelines, Imitation/RL Concepts, Robotics Software Infrastructure",
        "project_edits": {0: "Emphasized CARLA simulation, camera-LiDAR datasets, multi-task training, GPU mixed precision, and evaluation infrastructure.", 2: "Emphasized Gazebo simulation and validation of autonomy algorithms."},
        "keywords": ["simulation", "training infrastructure", "robot AI", "multimodal", "camera", "LiDAR", "PyTorch", "GPU", "validation", "CARLA", "Gazebo", "Python", "robotics", "navigation", "manipulation", "datasets", "parallelization", "robot learning"],
        "target": 91,
        "confirm": [*COMMON_CONFIRM, "onsite willingness for Belmont, CA"],
        "gap": "Reach items: 4+ years simulation/training infrastructure and leadership. Resume emphasizes truthful CARLA/Gazebo simulation, multimodal perception, ML training/evaluation, and robotics software.",
    },
    {
        "folder": "skydio-autonomy-software-engineer",
        "company": "Skydio",
        "role": "Autonomy Software Engineer",
        "location": "San Mateo, CA",
        "url": "https://jobs.ashbyhq.com/skydio/a48fe41b-030b-4f11-bf25-df7446151854/application",
        "listingUrl": "https://jobs.ashbyhq.com/skydio/a48fe41b-030b-4f11-bf25-df7446151854",
        "summary": "Robotics Software Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Hands-on experience implementing autonomy-adjacent algorithms across perception, localization, motion planning, controls, sensor fusion, simulation, and physical robot validation using Python, C/C++, ROS/ROS 2 concepts, CARLA, Gazebo, LiDAR, cameras, and PID control. Strong fit for autonomy software involving motion planning, state estimation, simulation, sensor characterization, and drone/robotics reliability.",
        "skills_add": "Role Emphasis: Autonomy Software, Drone Autonomy, Motion Planning, Controls, State Estimation, Sensor Characterization, UAS Concepts, Simulation, Flight-Like Validation, C++/Python, Production-Level Code",
        "project_edits": {1: "Emphasized physical aerial robot PID control, sensor fusion, safety checks, and real-time autonomous behavior.", 2: "Emphasized motion-planning algorithm implementation and simulation validation."},
        "keywords": ["autonomy", "C++", "Python", "motion planning", "controls", "state estimation", "sensor fusion", "computer vision", "simulation", "robotics", "drones", "UAS", "path planning", "CARLA", "Gazebo", "real-time"],
        "target": 92,
        "confirm": [*COMMON_CONFIRM, "hybrid/onsite willingness for San Mateo, CA"],
        "gap": "Reach items: production drone autonomy ownership. Resume emphasizes truthful aerial robot controls, simulation validation, perception, state estimation, and C++/Python software.",
    },
    {
        "folder": "bear-robotics-autonomy",
        "company": "Bear Robotics",
        "role": "Robotics Software Engineer II, Autonomy",
        "location": "Redwood City, CA",
        "url": "https://bear-robotics.breezy.hr/p/f1b7a8aa0763-robotics-software-engineer-ii-autonomy?source=GoogleJobs",
        "listingUrl": "https://bear-robotics.breezy.hr/p/f1b7a8aa0763-robotics-software-engineer-ii-autonomy?source=GoogleJobs",
        "summary": "Robotics Software Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Hands-on experience with mobile robot navigation concepts, localization, mapping, path planning, trajectory optimization, sensor fusion, Kalman/particle filter fundamentals, LiDAR/camera perception, Python, C/C++, ROS/ROS 2 concepts, Gazebo, and physical robot controls. Strong fit for autonomy software across navigation stack development, SLAM/localization, path planning, perception integration, and robot behavior validation.",
        "skills_add": "Role Emphasis: Mobile Robot Navigation Stack, SLAM + Localization, Kalman/Particle Filtering, Sensor Fusion, Path Planning, A*/RRT Concepts, Trajectory Optimization, Robot Dynamics & Control, Camera/LiDAR Perception, Python Data Analysis",
        "project_edits": {1: "Emphasized localization, navigation, closed-loop control, and physical robot validation.", 2: "Emphasized 3D RRT path planning, trajectory optimization, and Gazebo simulation."},
        "keywords": ["mobile robot", "navigation stack", "localization", "mapping", "path planning", "trajectory optimization", "SLAM", "Kalman", "particle filter", "sensor fusion", "LiDAR", "camera", "perception", "Python", "ROS", "controls"],
        "target": 94,
        "confirm": [*COMMON_CONFIRM, "onsite/hybrid willingness for Redwood City, CA"],
        "gap": "Reach items: 2+ years mobile robot industry experience. Resume emphasizes truthful mobile robot navigation coursework, localization, sensor fusion, physical control, and path planning.",
    },
    {
        "folder": "chef-robotics-staff-autonomy",
        "company": "Chef Robotics",
        "role": "Staff Autonomy Engineer",
        "location": "San Francisco, CA",
        "url": "https://jobs.lever.co/ChefRobotics/1afd1c21-cfe7-4a0a-8288-963cc806a1a5/apply",
        "listingUrl": "https://jobs.lever.co/ChefRobotics/1afd1c21-cfe7-4a0a-8288-963cc806a1a5",
        "summary": "Robotics Software Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Hands-on experience developing autonomy building blocks across perception, localization, sensor fusion, motion planning, controls, simulation validation, and physical robot testing using Python, C/C++, PyTorch, ROS/ROS 2 concepts, Gazebo, CARLA, LiDAR, cameras, and PID control. Strong fit for autonomy stack work involving perception, action prediction concepts, closed-loop control, and production-minded robotics software.",
        "skills_add": "Role Emphasis: Autonomy Stack, Perception, Action Prediction Concepts, Closed-Loop Control, Manipulation Concepts, Motion Planning, Sensor Fusion, Robot Reliability, C++/Python, ROS/ROS2, Real-World Robot Validation",
        "project_edits": {0: "Emphasized multi-task perception and model evaluation for autonomy outputs.", 1: "Emphasized closed-loop physical robot control and reliability validation."},
        "keywords": ["autonomy", "perception", "closed-loop control", "motion planning", "sensor fusion", "C++", "Python", "ROS", "ROS2", "robot reliability", "manipulation", "action prediction", "robotics software", "validation"],
        "target": 90,
        "confirm": [*COMMON_CONFIRM, "San Francisco onsite 5 days/week willingness", "expected start date", "source/how heard", "future sponsorship answer"],
        "gap": "Reach items: staff-level production autonomy ownership. Resume emphasizes truthful autonomy foundations, physical robot controls, perception research, and strong software background.",
    },
    {
        "folder": "gecko-field-software-engineer-manufacturing",
        "company": "Gecko Robotics",
        "role": "Field Software Engineer - Manufacturing",
        "location": "Boston, MA",
        "url": "https://jobs.ashbyhq.com/gecko-robotics/5975c3b1-5360-4f1c-ae79-d633cb22397d/application",
        "listingUrl": "https://jobs.ashbyhq.com/gecko-robotics/5975c3b1-5360-4f1c-ae79-d633cb22397d",
        "summary": "Robotics Software Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Hands-on experience building robotics-adjacent software interfaces, backend systems, data pipelines, sensor/perception workflows, ROS/ROS 2 concepts, Docker, Python, TypeScript/JavaScript, React, Linux, and physical robot validation. Strong fit for field-deployed manufacturing software connecting robotic control, data collection, edge devices, customer feedback, and durable production systems.",
        "skills_add": "Role Emphasis: Field Software Engineering, Manufacturing Software, Robotic Control Interfaces, Data Collection Systems, Edge Devices, Edge Deployment, Python, TypeScript, React, Electron Concepts, Docker, ROS, APIs, Distributed Systems, Customer-Facing Iteration",
        "project_edits": {0: "Emphasized data collection, perception outputs, and durable evaluation pipelines.", 1: "Emphasized physical robot validation and sensor/control interfaces."},
        "keywords": ["field software", "manufacturing", "Python", "TypeScript", "React", "Docker", "ROS", "robotic control", "data collection", "edge devices", "APIs", "interfaces", "distributed systems", "customer", "deployment", "NDT", "industrial"],
        "target": 91,
        "confirm": [*COMMON_CONFIRM, "Boston onsite/in-office acknowledgement", "future sponsorship answer", "source/how heard", "travel up to 25%"],
        "gap": "Reach items: 5+ years production systems and government-program manufacturing context. Resume emphasizes truthful backend production experience, robotic control interfaces, Docker, ROS concepts, and field-style validation.",
    },
    {
        "folder": "locus-manufacturing-test-engineer",
        "company": "Locus Robotics",
        "role": "Senior Manufacturing Test Engineer (Electrical)",
        "location": "Wilmington, MA",
        "url": "https://job-boards.greenhouse.io/locusrobotics/jobs/5145588007",
        "listingUrl": "https://job-boards.greenhouse.io/locusrobotics/jobs/5145588007",
        "summary": "Robotics Software Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Hands-on experience designing automated validation workflows for robotic systems, testing sensor/control behavior, logging data, diagnosing model/software failures, building Python software, using Linux command-line workflows, and collaborating across software and hardware boundaries. Strong fit for manufacturing test work involving autonomous mobile robots, automated test sequences, sensors, power/control interfaces, data analysis, and production-quality documentation.",
        "skills_add": "Role Emphasis: Manufacturing Test, End-of-Line Test, Automated Test Sequences, Functional Verification, Sensors, Actuators, Power Systems Concepts, Python Hardware Interfaces, Linux/Bash, Test Fixtures, Data Acquisition Concepts, Yield/Failure Analysis",
        "project_edits": {1: "Emphasized automated test sequences, sensor logs, failsafes, and physical robot validation.", 4: "Emphasized industrial automation, sensors, actuators, and basic PLC/control logic for manufacturing simulation."},
        "keywords": ["manufacturing test", "end-of-line", "automated test", "functional verification", "Python", "C++", "Linux", "Bash", "sensors", "actuators", "power systems", "data acquisition", "failure analysis", "robotics", "documentation", "test fixtures", "AMR"],
        "target": 90,
        "confirm": [*COMMON_CONFIRM, "state currently lived in", "work authorization and future sponsorship answers", "years of manufacturing test/production engineering", "1-10 ratings for Linux, schematics/PCB, embedded protocols, Python hardware interfacing, data acquisition"],
        "gap": "Reach items: 6+ years manufacturing test, schematics/PCB, and embedded protocols. Resume emphasizes truthful automated robotics testing, Python, Linux, sensors, data analysis, and physical robot validation.",
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
        "body": ParagraphStyle("body", fontName=REGULAR, fontSize=8.65, leading=10.1, spaceAfter=1.0, textColor=colors.black),
        "bodyBold": ParagraphStyle("bodyBold", fontName=BOLD, fontSize=8.85, leading=10.2, spaceAfter=0.95, textColor=colors.black),
        "itemTitle": ParagraphStyle("itemTitle", fontName=BOLD, fontSize=9.1, leading=10.3, spaceBefore=2.7, spaceAfter=0.25, textColor=colors.black),
        "subtle": ParagraphStyle("subtle", fontName="Carlito-Italic", fontSize=8.6, leading=9.9, spaceAfter=0.85, textColor=colors.black),
        "bullet": ParagraphStyle("bullet", fontName=REGULAR, fontSize=8.55, leading=10.2, leftIndent=10, firstLineIndent=-7, spaceAfter=1.25, textColor=colors.black),
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
        if idx == 0:
            story.append(PageBreak())
            story.extend(section("PROJECT EXPERIENCE (CONTINUED)", s))
    work_story: list[Any] = section("WORK EXPERIENCE", s)
    for job in WORK:
        work_story.append(rich(f'<b>{escape(job["name"])}</b> {escape(job["date"])}', s["itemTitle"]))
        work_story.append(rich(f'<i>{escape(job["loc"])}</i>', s["subtle"]))
        for bullet in job["bullets"]:
            work_story.append(Paragraph("&bull; " + escape(bullet), s["bullet"]))
    story.extend(work_story)
    doc.build(story)
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
    raw = round(100 * len(hits) / len(keywords))
    calibrated = min(target, raw)
    missing = [kw for kw in keywords if kw not in hits]
    return {"rawKeywordCoverage": raw, "atsScore": calibrated, "hits": len(hits), "total": len(keywords), "missing": missing}


def bold_checks(pdf: Path) -> dict[str, bool]:
    needles = ["B.S. Computer Science", "Parrot MiniDrone", "3D Motion Planning", "Backend Developer Intern", "Localization & SLAM"]
    doc = fitz.open(pdf)
    checks: dict[str, bool] = {}
    for needle in needles:
        ok = False
        for page in doc:
            for block in page.get_text("dict")["blocks"]:
                if block.get("type") != 0:
                    continue
                for line in block["lines"]:
                    line_text = "".join(span["text"] for span in line["spans"])
                    if needle in line_text and any("Bold" in span["font"] for span in line["spans"]):
                        ok = True
        checks[needle] = ok
    doc.close()
    return checks


def main() -> int:
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    reference_pages = render_png(REFERENCE, "reference-kforce")
    summary = []
    for role in ROLES:
        resume = render_resume(role)
        previews = render_png(resume, "resume-preview")
        comparison = resume.parent / "format-comparison-page-1.png"
        compare(reference_pages[0], previews[0], comparison)
        doc = fitz.open(resume)
        fonts = sorted({span["font"] for page in doc for block in page.get_text("dict")["blocks"] if block.get("type") == 0 for line in block["lines"] for span in line["spans"]})
        page_count = doc.page_count
        doc.close()
        summary.append({
            "company": role["company"],
            "role": role["role"],
            "location": role["location"],
            "applicationUrl": role["url"],
            "listingUrl": role["listingUrl"],
            "resume": str(resume),
            "previewPages": [str(path) for path in previews],
            "formatComparison": str(comparison),
            "formatValidation": {
                "reference": str(REFERENCE),
                "pageSize": "Letter 612x792",
                "pageCount": page_count,
                "fonts": fonts,
                "boldChecks": bold_checks(resume),
                "preservedSections": ["Professional Summary", "Education", "Technical Skills", "Localization & Perception Project Experience", "Work Experience"],
            },
            "ats": coverage(resume, role["keywords"], role["target"]),
            "gapAnalysis": role["gap"],
            "confirm": role["confirm"],
        })
    (OUT_ROOT / "package-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
