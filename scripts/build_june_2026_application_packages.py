#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer


ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = ROOT / "data" / "june-2026-ten-applications"
REFERENCE = Path(r"F:\Resume tracker\George_Jobi_Resume_Kforce.pdf")
BUILDER_PATH = ROOT / "scripts" / "build_next_ten_resume_packages.py"
VALIDATOR = ROOT / ".agents" / "skills" / "tailor-job-resume" / "scripts" / "validate_resume.py"
MANIFEST_BUILDER = ROOT / ".agents" / "skills" / "tailor-job-resume" / "scripts" / "build_package_manifest.py"


def load_builder():
    spec = importlib.util.spec_from_file_location("preserved_resume_builder", BUILDER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load resume builder: {BUILDER_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.OUT_ROOT = OUT_ROOT
    return module


COMMON_CONFIRM = [
    "Authorized to work in the United States now: Yes, through OPT eligibility.",
    "Future employment sponsorship required: Yes.",
    "Earliest start date: two weeks.",
    "Willing to relocate: anywhere in the United States.",
    "Salary expectation: within the posted range.",
]


ROLES: list[dict[str, Any]] = [
    {
        "folder": "figure-embedded-software-intern-fall-2026",
        "company": "Figure",
        "role": "Embedded Software Intern [Fall 2026]",
        "location": "San Jose, CA - On-site",
        "url": "https://job-boards.greenhouse.io/figureai/jobs/4397706006",
        "listingUrl": "https://job-boards.greenhouse.io/figureai/jobs/4397706006",
        "summary": "Embedded Robotics Software Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Hands-on experience with C/C++, Python, expert Linux, hardware-software integration, physical robot control, sensors, actuators, test automation, CI/CD, Docker, debugging, logging, and repeatable validation. Built and tested autonomy, perception, motion-planning, and closed-loop control software across physical and simulated robot platforms.",
        "skills_add": "Role Emphasis: Embedded Software, C++, Python, Linux Expertise, Computer Architecture Concepts, Ethernet, EtherCAT Concepts, Serial Communication Concepts, CAN Concepts, USB Concepts, Hardware-Software Integration, Test Automation, Robot Calibration Concepts, CI/CD, Docker, Debugging Tools",
        "project_edits": {
            1: "Emphasized physical robot control, sensor interfaces, test automation, logging, failsafes, and hardware-software debugging.",
            4: "Emphasized sensors, actuators, basic control logic, integration testing, and hardware-aware automation.",
        },
        "keywords": ["embedded software", "C++", "Python", "Linux", "computer architecture", "Ethernet", "EtherCAT", "serial communication", "CAN", "USB", "hardware-software integration", "test automation", "robot calibration", "CI/CD", "Docker", "debugging tools"],
        "target": 95,
        "confirm": [*COMMON_CONFIRM, "Full-time on-site internship in San Jose for at least 10 weeks beginning Fall 2026: Yes.", "Communication-bus and lab-instrument depth is represented as concepts where direct hands-on evidence is not verified.", "No cover letter is requested by the live form."],
        "gap": "Direct production embedded firmware ownership, Bazel, Rust, oscilloscopes, logic analyzers, and Lauterbach debugging are not verified. The package emphasizes truthful C/C++, Python, expert Linux, physical robot control, sensor integration, automated validation, CI/CD, and Docker while labeling adjacent bus and calibration knowledge as concepts.",
    },
    {
        "folder": "kodiak-fall-2026-perception-intern",
        "company": "Kodiak",
        "role": "Fall 2026 Intern, Perception",
        "location": "Mountain View, CA - On-site",
        "url": "https://job-boards.greenhouse.io/kodiak/jobs/4174533009",
        "listingUrl": "https://job-boards.greenhouse.io/kodiak/jobs/4174533009",
        "summary": "Robotics Perception Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Research experience designing and evaluating camera-LiDAR perception, object detection, depth estimation, mapping, localization, sensor fusion, and scene-understanding pipelines using C/C++, Python, PyTorch, CARLA, OpenCV, and expert Linux. Built production-minded machine-learning pipelines spanning data preparation, training, validation, documentation, debugging, and performance optimization.",
        "skills_add": "Role Emphasis: Robotics Perception, C++, Python, Object Detection, Classification, Multi-Object Tracking Concepts, Sensor Fusion, Scene Estimation, Deep Neural Networks, Kalman Filter Concepts, Particle Filter Concepts, Point Cloud Processing, Camera, LiDAR, Dataset Collection, Labeling, Training, Validation",
        "project_edits": {
            0: "Emphasized camera-LiDAR perception algorithms, object detection, depth estimation, point-cloud processing, scene estimation, dataset workflows, and rigorous model validation.",
            1: "Emphasized real-hardware visual and inertial sensor fusion, state estimation, logging, and repeatable validation.",
        },
        "keywords": ["robotics perception", "C++", "Python", "object detection", "classification", "multi-object tracking", "sensor fusion", "scene estimation", "deep neural networks", "Kalman filter", "particle filter", "point cloud processing", "camera", "LiDAR", "dataset collection", "labeling", "training", "validation", "documentation"],
        "target": 95,
        "confirm": [*COMMON_CONFIRM, "Fall 2026 internship in Mountain View for 12-16 weeks: Yes.", "Future employment sponsorship: Yes.", "Cover letter is optional and not needed because the tailored resume directly demonstrates perception research fit."],
        "gap": "Professional C++ perception deployment, radar or ultrasound processing, and direct multi-object tracking ownership are not verified. The package labels tracking and filtering depth as concepts and foregrounds verified camera-LiDAR fusion, object detection, depth estimation, mapping, localization, PyTorch research, and production ML pipelines.",
    },
    {
        "folder": "scout-ai-robotics-software-engineer",
        "company": "Scout AI",
        "role": "Robotics Software Engineer",
        "location": "Sunnyvale, CA - On-site",
        "url": "https://job-boards.greenhouse.io/scoutai/jobs/5137118008",
        "listingUrl": "https://job-boards.greenhouse.io/scoutai/jobs/5137118008",
        "summary": "Robotics Software Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Hands-on experience building perception, localization, navigation, motion-planning, sensor-fusion, control, simulation, testing, and monitoring workflows using C/C++, Python, expert Linux, ROS/ROS 2 concepts, Gazebo, CARLA, cameras, LiDAR, and IMU-style data. Built software for physical aerial robots and scalable production systems with strong debugging, reliability, and hardware-software integration practices.",
        "skills_add": "Role Emphasis: Robotics Software, Drone Autonomy, Perception, Planning, Control Systems, Autonomy Pipelines, Cameras, LiDAR, IMU, Localization, Mapping, Navigation, Simulation Infrastructure, Testing Environments, System Reliability, Performance, Deployment Monitoring",
        "project_edits": {
            1: "Emphasized advanced drone hardware, autonomous flight-like control, sensing, safety, reliability, and physical robot validation.",
            2: "Emphasized planning, navigation, simulation infrastructure, testing, and trajectory validation.",
        },
        "keywords": ["robotics software", "drone autonomy", "perception", "planning", "control systems", "autonomy pipelines", "cameras", "LiDAR", "IMU", "localization", "mapping", "navigation", "simulation infrastructure", "testing environments", "system reliability", "performance", "deployment monitoring", "C++", "Python"],
        "target": 95,
        "confirm": [*COMMON_CONFIRM, "On-site work and relocation to Sunnyvale, California: Yes.", "Legally authorized to work in the United States now: Yes through OPT eligibility.", "Future sponsorship: Yes.", "No cover letter is requested by the live form."],
        "gap": "Professional defense robotics deployment, foundation-model agents, and production fleet monitoring are not verified. The package emphasizes verified physical drone controls, autonomy research, simulation, sensor fusion, production software, reliability, and monitoring without claiming export-controlled access or defense experience.",
    },
    {
        "folder": "roboforce-ai-resident",
        "company": "RoboForce",
        "role": "AI Resident",
        "location": "Milpitas, CA - On-site",
        "url": "https://job-boards.greenhouse.io/roboforce/jobs/5196164008",
        "listingUrl": "https://job-boards.greenhouse.io/roboforce/jobs/5196164008",
        "summary": "Robotics and Machine Learning Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Research experience with PyTorch, multimodal camera-LiDAR learning, GPU-accelerated training, perception, localization, mapping, navigation, model evaluation, simulation, physical robot control, data collection, and failure analysis. Strong software background in Python, C/C++, expert Linux, production ML integration, automated testing, and AI-assisted development workflows.",
        "skills_add": "Role Emphasis: Embodied AI, Physical Intelligence, Vision-Language-Action Concepts, World Model Concepts, Simulation, Sim-to-Real Concepts, Reinforcement Learning Concepts, Imitation Learning Concepts, Multimodal Learning, PyTorch, Data Collection Systems, Training Pipelines, Evaluation Pipelines, Physical Robots, AI-Assisted Coding",
        "project_edits": {
            0: "Emphasized multimodal learning, GPU training, large-scale evaluation, simulation data, failure analysis, and perception-to-action autonomy outputs.",
            1: "Emphasized physical robot data collection, control, evaluation workflows, and rapid iteration between software and hardware.",
        },
        "keywords": ["embodied AI", "physical intelligence", "Vision-Language-Action", "World Models", "simulation", "sim-to-real", "reinforcement learning", "imitation learning", "multimodal learning", "PyTorch", "data collection systems", "training pipelines", "evaluation pipelines", "physical robots", "AI-assisted coding", "Python"],
        "target": 95,
        "confirm": [*COMMON_CONFIRM, "Full-time on-site work in Milpitas five days per week: Yes.", "The resume labels VLA, World Models, sim-to-real, reinforcement learning, and imitation learning as concepts rather than completed project ownership.", "No cover letter is requested by the live form."],
        "gap": "Direct VLA, World Model, reinforcement-learning policy training, manipulation, Isaac Sim, MuJoCo, and publication experience are not verified. The package labels these adjacent areas as concepts and emphasizes verified multimodal PyTorch research, simulation, physical robot control, data pipelines, evaluation, and failure analysis.",
    },
    {
        "folder": "ai2-robotics-research-intern",
        "company": "The Allen Institute for Artificial Intelligence",
        "role": "Research Internship, Robotics",
        "location": "Seattle, WA - On-site",
        "url": "https://job-boards.greenhouse.io/thealleninstitute/jobs/7366273",
        "listingUrl": "https://job-boards.greenhouse.io/thealleninstitute/jobs/7366273",
        "summary": "Robotics and AI Researcher pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Research experience in computer vision, robotics, machine learning, embodied AI concepts, camera-LiDAR perception, localization, mapping, navigation, model evaluation, dataset pipelines, simulation, and physical robot control using Python, C/C++, PyTorch, CARLA, Gazebo, OpenCV, and expert Linux. Experienced conducting experiments, diagnosing model failures, documenting results, and building reproducible research software.",
        "skills_add": "Role Emphasis: Robotics Research, Artificial Intelligence Research, Computer Vision, Machine Learning, Embodied AI Concepts, Foundation Model Concepts, Open Datasets, Benchmarks, Model Evaluation, Scientific Literature, Experiments, PyTorch, CARLA, Gazebo, Physical Robots, Reproducible Research",
        "project_edits": {
            0: "Emphasized research hypotheses, multimodal datasets, controlled experiments, benchmark metrics, reproducibility, and documented model evaluation.",
            1: "Emphasized physical robot experimentation, simulator-to-hardware reasoning, sensing, control, and repeatable evaluation.",
        },
        "keywords": ["robotics research", "artificial intelligence research", "computer vision", "machine learning", "embodied AI", "foundation models", "open datasets", "benchmarks", "model evaluation", "scientific literature", "experiments", "PyTorch", "CARLA", "Gazebo", "physical robots", "reproducible research"],
        "target": 95,
        "confirm": [*COMMON_CONFIRM, "On-site work and relocation to Seattle: Yes.", "Legally eligible to work in the United States: Yes.", "Future visa sponsorship: Yes; the posting states sponsorship is available.", "Publication list and any advisor information must be confirmed before submission.", "A cover letter is optional and not needed unless the user requests one."],
        "gap": "Peer-reviewed publications, direct foundation-model research, and a named research advisor are not currently verified. The package emphasizes verified graduate research, multimodal perception, experiments, evaluation, simulation, physical robots, and reproducibility while labeling embodied and foundation-model areas as concepts.",
    },
    {
        "folder": "quince-software-development-engineer-new-grad",
        "company": "Quince",
        "role": "Software Development Engineer [New Grad]",
        "location": "Palo Alto, CA - Hybrid",
        "url": "https://job-boards.greenhouse.io/quince/jobs/5226786008",
        "listingUrl": "https://job-boards.greenhouse.io/quince/jobs/5226786008",
        "summary": "Software Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science and production software internship experience. Strong background in Java, JavaScript, Python, C++, TypeScript, Node.js, React, REST APIs, scalable backend systems, distributed services, data pipelines, testing, monitoring, debugging, reliability, documentation, and performance optimization. Delivered end-to-end software and ML integrations in fast-paced startup environments while collaborating across engineering and product teams.",
        "skills_add": "Role Emphasis: Software Development, Java, JavaScript, Python, C++, Scalable Software Systems, Feature Ownership, End-to-End Delivery, Monitoring, Debugging, Issue Resolution, Documentation, Coding Standards, Data Quality, Performance, Reliability, AI-Powered Development Tools, Testing",
        "project_edits": {
            3: "Emphasized iterative subsystem ownership, Python development, documentation, testing, and integration across engineering constraints.",
            4: "Emphasized end-to-end workflow design, state management, data quality, reliability checks, and system integration.",
        },
        "keywords": ["software development", "Java", "JavaScript", "Python", "C++", "scalable software systems", "feature ownership", "end-to-end", "monitoring", "debugging", "issue resolution", "documentation", "coding standards", "data quality", "performance", "reliability", "AI-powered development tools", "testing"],
        "target": 95,
        "confirm": [*COMMON_CONFIRM, "Hybrid work and relocation to Palo Alto, California: Yes.", "Current authorization category: F-1 OPT/STEM OPT.", "Future sponsorship category: H-1B.", "Current university: Other - Arizona State University.", "Cover letter is optional and not needed because the resume directly demonstrates the requested evidence."],
        "gap": "The posting introduction emphasizes upcoming undergraduates, while the qualifications accept a Bachelor's or Master's degree and George is a current master's student with a completed CS bachelor's. Retail-domain experience is not verified; the package emphasizes production software, end-to-end delivery, testing, monitoring, reliability, and performance.",
    },
    {
        "folder": "elevate-robotics-software-engineer-intern",
        "company": "Elevate Robotics",
        "role": "Software Engineer - Intern Summer 2026",
        "location": "Austin, TX - On-site",
        "url": "https://job-boards.greenhouse.io/elevaterobotics/jobs/4207387009",
        "listingUrl": "https://job-boards.greenhouse.io/elevaterobotics/jobs/4207387009",
        "summary": "Robotics Software Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Hands-on experience with C/C++, Python, expert Linux, ROS/ROS 2 concepts, control-system tuning, perception, navigation, manipulation concepts, physical robot bring-up, sensors, actuators, Gazebo simulation, testing, Git, CI/CD, and hardware-software integration. Built and validated autonomy, motion-planning, perception, and closed-loop control systems on physical and simulated platforms.",
        "skills_add": "Role Emphasis: C++, Python, Linux Expertise, ROS, ROS2, Control System Tuning, Robot Modeling, Autonomy Integration, Perception, Navigation, Manipulation Concepts, Production Robot Bring-Up, Hardware Integration, Git, Testing, Reliability",
        "project_edits": {
            1: "Emphasized physical robot bring-up, PID tuning, sensor fusion, reliability checks, and hardware-software debugging.",
            2: "Emphasized C++/Python-compatible robotics algorithms, Gazebo simulation, motion planning, and repeatable validation.",
        },
        "keywords": ["C++", "Python", "Linux", "ROS", "ROS2", "control system tuning", "robot modeling", "autonomy integration", "perception", "navigation", "manipulation", "production robot bring-up", "hardware integration", "Git", "testing", "reliability", "sensors", "actuators"],
        "target": 95,
        "confirm": [*COMMON_CONFIRM, "On-site work and relocation to Austin, Texas: Yes.", "Cover letter is optional and not needed because the resume directly demonstrates the requested robotics evidence."],
        "gap": "Direct production robot bring-up ownership and industrial manipulator tuning are not verified. The package emphasizes truthful physical drone control, sensor integration, PID tuning, Gazebo motion planning, C++/Python, Linux, and robotics coursework.",
    },
    {
        "folder": "cerebras-software-engineer-new-grad-2026",
        "company": "Cerebras",
        "role": "Software Engineer - New Grad 2026",
        "location": "Sunnyvale, CA - Hybrid",
        "url": "https://job-boards.greenhouse.io/earlytalentcerebras/jobs/7731286003",
        "listingUrl": "https://job-boards.greenhouse.io/earlytalentcerebras/jobs/7731286003",
        "summary": "Software and robotics engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Strong background in C/C++, Python, expert Linux, distributed systems, backend infrastructure, hardware-software integration, embedded-systems concepts, networking fundamentals, concurrent workloads, debugging, performance optimization, observability, Docker, CI/CD, and GPU-accelerated machine learning pipelines. Experienced building reliable production software and performance-aware autonomy systems, instrumenting services with health metrics, diagnosing failures across APIs and data pipelines, and improving latency through measured, test-driven iteration.",
        "skills_add": "Role Emphasis: C, C++, Python, Linux Systems, Distributed Systems, Systems Programming Concepts, Networking Fundamentals, Socket Programming Concepts, Embedded Systems Concepts, Hardware Interfaces, Concurrent Programming, Performance Optimization, Debugging, Observability, Reliability",
        "project_edits": {
            0: "Emphasized GPU-accelerated workloads, performance optimization, failure analysis, evaluation infrastructure, and hardware-aware ML systems.",
            4: "Emphasized system integration, state tracking, sensor data flow, testability, and failure-aware control logic in the upcoming automation project.",
        },
        "keywords": ["C", "C++", "Python", "Linux systems", "distributed systems", "systems programming", "networking", "socket programming", "embedded systems", "hardware interfaces", "concurrent programming", "performance optimization", "debugging", "observability", "reliability", "Docker", "CI/CD", "GPU"],
        "target": 95,
        "confirm": [*COMMON_CONFIRM, "Hybrid work and relocation to Sunnyvale, California: Yes.", "The export-control form must be answered truthfully using the candidate's home country/citizenship details.", "No cover letter is requested by the live form."],
        "gap": "Low-level device-driver, RDMA, kernel, and production systems-programming ownership are not verified. The package labels adjacent areas as concepts and emphasizes C/C++, expert Linux, distributed software, hardware-aware robotics, debugging, and performance work.",
    },
    {
        "folder": "benchling-software-engineer-new-grad-2026",
        "company": "Benchling",
        "role": "Software Engineer, New Grad (2026)",
        "location": "San Francisco, CA - Hybrid",
        "url": "https://job-boards.greenhouse.io/benchling/jobs/7386982",
        "listingUrl": "https://job-boards.greenhouse.io/benchling/jobs/7386982",
        "summary": "Software Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science and production internship experience. Strong background in Python, TypeScript, JavaScript, React, Node.js, REST APIs, backend systems, distributed services, data pipelines, PostgreSQL, MongoDB, AWS, Docker, CI/CD, testing, observability, and cross-functional product development. Delivered reliable end-to-end software and machine-learning integrations in startup environments.",
        "skills_add": "Role Emphasis: Product Engineering, Platform Engineering, Backend Models, REST API Endpoints, React Applications, Python, TypeScript, JavaScript, Node.js, Distributed Systems, Infrastructure Tools, Prototype Development, Large-Scale Rollout, End-to-End Ownership, Software Internship Experience, Testing, Reliability, Cross-Functional Collaboration",
        "project_edits": {
            3: "Emphasized iterative product development, Python-based subsystem design, documentation, and integration across mechanical and software constraints.",
            4: "Emphasized end-to-end workflow design, state management, testing, and cross-functional automation integration.",
        },
        "keywords": ["product engineering", "platform engineering", "backend models", "API endpoints", "React", "Python", "TypeScript", "JavaScript", "Node.js", "distributed systems", "infrastructure tools", "prototype", "large-scale rollout", "testing", "reliability", "cross-functional collaboration", "ownership", "software internship"],
        "target": 95,
        "confirm": [*COMMON_CONFIRM, "Expected graduation: July 2026.", "Hybrid work in San Francisco on Monday, Tuesday, and Thursday: Yes.", "Cover letter is optional and not needed because the resume and form already communicate fit."],
        "gap": "Life-sciences software experience is not verified. The package emphasizes directly relevant production internships, backend and full-stack ownership, APIs, React, distributed systems, testing, and product-focused delivery.",
    },
    {
        "folder": "applovin-backend-engineer-new-grad",
        "company": "AppLovin",
        "role": "Backend Engineer, New Grad",
        "location": "Palo Alto, CA - On-site",
        "url": "https://job-boards.greenhouse.io/applovin/jobs/4451556006",
        "listingUrl": "https://job-boards.greenhouse.io/applovin/jobs/4451556006",
        "summary": "Backend Software Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science and production software internship experience. Strong background in C++, Java, Python, Node.js, TypeScript, REST APIs, distributed systems, high-throughput data processing, PostgreSQL, MongoDB, AWS, Docker, CI/CD, observability, testing, reliability, and performance optimization. Built and maintained scalable backend and ML-integrated systems in startup environments.",
        "skills_add": "Role Emphasis: Backend Engineering, C++, Java, Python, Distributed Systems, High Availability, Low Latency, Large-Scale Infrastructure, Data Structures, Algorithms, API Integration, Performance Optimization, Reliability, Testing, Monitoring, Cross-Functional Collaboration",
        "project_edits": {
            3: "Emphasized maintainable Python subsystem development, iterative integration, and technical documentation.",
            4: "Emphasized state management, data flow, reliability checks, and integration testing for an end-to-end automation workflow.",
        },
        "keywords": ["backend engineering", "C++", "Java", "Python", "distributed systems", "high availability", "low latency", "large-scale infrastructure", "data structures", "algorithms", "API integration", "performance optimization", "reliability", "testing", "monitoring", "cross-functional collaboration", "software internship", "ownership"],
        "target": 95,
        "confirm": [*COMMON_CONFIRM, "On-site work and relocation to Palo Alto, California: Yes.", "Future sponsorship: Yes.", "Salary expectation should be entered as a numeric value within the posted $124,000-$186,000 range.", "Cover letter is optional and not needed because the resume directly demonstrates backend fit."],
        "gap": "Advertising-platform experience and professional Java ownership are weaker than requested. The package emphasizes verified C++, Java coursework, production backend systems, distributed processing, reliability, monitoring, and measurable performance improvement.",
    },
    {
        "folder": "simbe-robotics-software-engineer",
        "company": "Simbe Robotics",
        "role": "Robotics Software Engineer (C++ & Python)",
        "location": "San Francisco Bay Area, CA - Hybrid",
        "url": "https://jobs.lever.co/SimbeRobotics/bffe760d-b1fb-49ff-b259-f0724c8661fa/apply",
        "listingUrl": "https://jobs.lever.co/SimbeRobotics/bffe760d-b1fb-49ff-b259-f0724c8661fa",
        "summary": "Robotics Software Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Hands-on experience using C/C++, Python, ROS/ROS 2 concepts, Linux/Ubuntu, Gazebo, CARLA, Git, CI/CD, Docker, localization, mapping, perception, sensor fusion, navigation, autonomous behaviors, hardware-aware control, testing, and diagnostics. Built software for physical and simulated robots and production-oriented backend systems, with a focus on reliable, maintainable autonomous systems.",
        "skills_add": "Role Emphasis: C++, Python, ROS1, ROS2, ROS Nodes, Navigation, Perception, Autonomous Behaviors, Hardware Drivers, Bash, Ubuntu, Git, CI/CD, Automated Regression Testing, Docker, Cloud Integration",
        "project_edits": {
            1: "Emphasized physical robot control, sensor fusion, diagnostics, automated testing, and failure-aware operation.",
            2: "Emphasized ROS/Gazebo navigation software and repeatable simulation validation.",
        },
        "keywords": ["C++", "Python", "ROS1", "ROS2", "ROS Nodes", "navigation", "perception", "autonomous behaviors", "hardware drivers", "Bash", "Ubuntu", "Git", "CI/CD", "automated regression testing", "Docker", "cloud integration", "sensor fusion", "Linux"],
        "target": 95,
        "confirm": [*COMMON_CONFIRM, "Relocation to the Bay Area: Yes.", "Professional ROS response must describe academic and project experience without calling it industry experience."],
        "gap": "Professional ROS1/ROS2 ownership and approximately two years of robotics industry experience are weaker than requested. The package emphasizes verified ROS/Gazebo coursework, physical drone controls, C++/Python, Linux, CI/CD, and production software experience.",
    },
    {
        "folder": "multiply-labs-robotics-software-engineer-ii",
        "company": "Multiply Labs",
        "role": "Robotics Software Engineer II",
        "location": "San Francisco, CA - On-site",
        "url": "https://jobs.lever.co/multiplylabs/9f0b3551-9565-4eef-95a6-6ad36eaf9837/apply",
        "listingUrl": "https://jobs.lever.co/multiplylabs/9f0b3551-9565-4eef-95a6-6ad36eaf9837",
        "summary": "Robotics Software Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Hands-on experience with Python, C/C++, hardware-software integration, trajectory planning, motion control, kinematics, coordinate transforms, Gazebo simulation, automated test workflows, Git, CI/CD, sensors, actuators, and cross-functional debugging. Built physical robot control and sensor-fusion systems plus production software used at scale.",
        "skills_add": "Role Emphasis: Python, Hardware-Software Integration, Machine Interfaces, Robotic Arms Concepts, Trajectory Planning, Motion Control, Kinematics, Coordinate Transforms, Gazebo, Simulation, Automated Test Suites, Git, CI/CD, System-Level Debugging",
        "project_edits": {
            1: "Emphasized physical hardware control, real-time sensor interfaces, safety checks, and system-level debugging.",
            4: "Emphasized honest upcoming manufacturing automation work with sensors, actuators, and basic PLC/control logic.",
        },
        "keywords": ["Python", "hardware-software integration", "machine interfaces", "robotic arms", "trajectory planning", "motion control", "kinematics", "coordinate transforms", "Gazebo", "simulation", "automated test suites", "Git", "CI/CD", "system-level debugging", "sensors", "actuators", "documentation", "code review"],
        "target": 95,
        "confirm": [*COMMON_CONFIRM, "On-site work in San Francisco: Yes.", "Domestic/international travel of 5-10%: Yes.", "Physical requirements and PPE: confirm if the form asks."],
        "gap": "Direct Universal Robot arm integration and regulated biomanufacturing experience are not verified. The package emphasizes truthful physical robot control, simulation, trajectory planning, manufacturing automation concepts, and hardware-software debugging.",
    },
    {
        "folder": "atomic-semi-robotics-software-engineer",
        "company": "Atomic Semi",
        "role": "Robotics Software Engineer",
        "location": "San Francisco, CA or Austin, TX - On-site",
        "url": "https://jobs.ashbyhq.com/atomicsemi/f30a35c7-4962-459a-bca7-1875f0fc0f8f/application",
        "listingUrl": "https://jobs.ashbyhq.com/atomicsemi/f30a35c7-4962-459a-bca7-1875f0fc0f8f",
        "summary": "Robotics Software Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Hands-on experience with C/C++, Python, computer vision, state estimation, camera-LiDAR sensor fusion, motion control, trajectory optimization, calibration concepts, physical hardware, simulation, testing, logging, and failure analysis. Built perception, localization, planning, and real-time control systems spanning software and robotics hardware.",
        "skills_add": "Role Emphasis: C++, C, Python, Computer Vision, State Estimation, Sensor Fusion, Motion Control, Trajectory Optimization, Calibration, Systems Modeling, Physical Hardware, Testing, Logging, Failure Modes, Gazebo",
        "project_edits": {
            0: "Emphasized computer vision, multi-sensor state estimation, model evaluation, and calibration-adjacent perception validation.",
            1: "Emphasized real-time motion control, physical hardware, logging, safety checks, and failure modes.",
        },
        "keywords": ["C++", "C", "Python", "computer vision", "state estimation", "sensor fusion", "motion control", "trajectory optimization", "calibration", "systems modeling", "physical hardware", "testing", "logging", "failure modes", "Gazebo", "object detection", "simulation", "firmware"],
        "target": 95,
        "confirm": [*COMMON_CONFIRM, "Preferred office: Austin, TX unless the application requires one choice and the user directs otherwise.", "A verified one-page project portfolio is included because the application requires a portfolio file or URL.", "Home country is required for the export-control question."],
        "gap": "Shipping precision robotics software and deep firmware/electrical debugging are weaker than requested. The role explicitly welcomes exceptional early-career applicants; the package emphasizes verified real-hardware control, perception, sensor fusion, planning, and debugging.",
    },
    {
        "folder": "metamorphic-robotics-engineer",
        "company": "Metamorphic",
        "role": "Robotics Engineer (Simulation, Hardware & Deployment)",
        "location": "Palo Alto, CA - On-site",
        "url": "https://jobs.ashbyhq.com/metamorphic/c58ddc03-4887-4add-855c-bcf6391ef575/application",
        "listingUrl": "https://jobs.ashbyhq.com/metamorphic/c58ddc03-4887-4add-855c-bcf6391ef575",
        "summary": "Robotics Software Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Hands-on experience with Python, C/C++, ROS/ROS 2 concepts, TF and URDF concepts, Gazebo and CARLA simulation, physical robot hardware, sensor integration, calibration concepts, trajectory data, sim-to-real validation, motion planning, control, computer vision, and reproducible testing. Comfortable debugging across software, models, sensors, and hardware.",
        "skills_add": "Role Emphasis: Python, C++, ROS, ROS2, TF, URDF, Simulation Pipelines, Robot Hardware, Sensor Integration, Calibration, Trajectory Data, Synchronization, Sim-to-Real, Motion Planning, Classical Control, Computer Vision",
        "project_edits": {
            1: "Emphasized physical robot operation, synchronized sensor data, calibration-adjacent testing, and safety procedures.",
            2: "Emphasized ROS/Gazebo simulation pipelines, motion planning, and reproducible evaluation.",
        },
        "keywords": ["Python", "C++", "ROS", "ROS2", "TF", "URDF", "simulation pipelines", "robot hardware", "sensor integration", "calibration", "trajectory data", "synchronization", "sim-to-real", "motion planning", "classical control", "computer vision", "Docker", "RGB-D cameras"],
        "target": 95,
        "confirm": [*COMMON_CONFIRM, "On-site work in Palo Alto: Yes."],
        "gap": "End-effector integration, teleoperation systems, and production robot bring-up ownership are not verified. The package emphasizes real drone hardware, synchronized sensing, ROS/Gazebo simulation, URDF work, control, and sim-to-real validation.",
    },
    {
        "folder": "roboforce-robotics-software-engineer",
        "company": "RoboForce",
        "role": "Robotics Software Engineer",
        "location": "Milpitas, CA - On-site",
        "url": "https://job-boards.greenhouse.io/roboforce/jobs/5181554008",
        "listingUrl": "https://job-boards.greenhouse.io/roboforce/jobs/5181554008",
        "summary": "Robotics Software Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Hands-on experience using C/C++, Python, expert Linux, perception, motion planning, controls, localization, state estimation, sensor fusion, physical robot integration, testing, validation, fault handling, performance tuning, Docker, CI/CD, telemetry concepts, and root-cause analysis. Built real and simulated autonomy systems plus production software and ML pipelines.",
        "skills_add": "Role Emphasis: C++, Python, Linux Expertise, Perception, Planning, Controls, Localization, State Estimation, System Integration, Testing, Validation, Fault Handling, Performance Tuning, Telemetry, Root Cause Analysis, Docker",
        "project_edits": {
            0: "Emphasized disciplined root-cause analysis, performance tuning, perception, and state-estimation outputs.",
            1: "Emphasized on-robot validation, fault handling, safety checks, and hardware-software integration.",
        },
        "keywords": ["C++", "Python", "Linux expertise", "perception", "planning", "controls", "localization", "state estimation", "system integration", "testing", "validation", "fault handling", "performance tuning", "telemetry", "root cause analysis", "Docker", "CI/CD", "physical robot"],
        "target": 95,
        "confirm": [*COMMON_CONFIRM, "Five days per week in Milpitas: Yes."],
        "gap": "Two years of professional robotics deployment and fleet-scale production support are weaker than requested. The package foregrounds physical robot validation, Linux, production software, perception, planning, controls, and cross-stack debugging.",
    },
    {
        "folder": "bright-machines-robot-perception-engineer",
        "company": "Bright Machines",
        "role": "Robot Perception Engineer - Smart Robotics",
        "location": "San Francisco, CA - Hybrid",
        "url": "https://jobs.lever.co/brightmachines/3e897651-c597-4496-bbd0-aca58afb1c69/apply",
        "listingUrl": "https://jobs.lever.co/brightmachines/3e897651-c597-4496-bbd0-aca58afb1c69",
        "summary": "Robot Perception Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Hands-on experience developing computer vision and deep learning systems for detection, segmentation, quality evaluation, localization, pose estimation, camera-LiDAR fusion, and navigation using Python, PyTorch, C/C++, OpenCV, ROS2 concepts, CARLA, and GPU training. Built data pipelines, model evaluation workflows, sensor integrations, and production-oriented computer vision systems.",
        "skills_add": "Role Emphasis: Computer Vision, Deep Learning, Visual Inspection, Defect Detection, Classification, Quality Validation, Vision-Based Navigation, Localization, Visual Servoing Concepts, Pose Estimation, Python, PyTorch, Data Pipelines, MLOps, Camera Systems, Sensor Integration",
        "project_edits": {
            0: "Emphasized detection, segmentation, pose and depth estimation, data pipelines, GPU training, and measurable perception gains.",
            4: "Emphasized the manufacturing and quality-validation context of the upcoming automation project.",
        },
        "keywords": ["computer vision", "deep learning", "visual inspection", "defect detection", "classification", "quality validation", "vision-based navigation", "localization", "visual servoing", "pose estimation", "Python", "PyTorch", "data pipelines", "MLOps", "camera systems", "sensor integration", "ROS2", "manufacturing"],
        "target": 95,
        "confirm": [*COMMON_CONFIRM, "Hybrid work and relocation to San Francisco: Yes."],
        "gap": "Industrial camera standards, optics/lighting design, CUDA/TensorRT deployment, and direct visual-inspection production ownership are not verified. The package emphasizes truthful PyTorch perception, camera/LiDAR fusion, model evaluation, and manufacturing automation context.",
    },
    {
        "folder": "path-robotics-software-engineer-systems",
        "company": "Path Robotics",
        "role": "Software Engineer - Robotics & Systems",
        "location": "Columbus, OH - On-site",
        "url": "https://job-boards.greenhouse.io/pathrobotics/jobs/8500622002",
        "listingUrl": "https://job-boards.greenhouse.io/pathrobotics/jobs/8500622002",
        "summary": "Robotics Software Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Hands-on experience with C/C++, Python, ROS/ROS2 concepts, embedded Linux, cameras, LiDAR, sensors, actuators, hardware interfaces, device-driver concepts, robot controls, perception, real-time workloads, GPU-accelerated ML, testing, and system bring-up on physical and simulated platforms.",
        "skills_add": "Role Emphasis: C++, Python, ROS, ROS2, Hardware Abstraction Layers Concepts, Device Drivers Concepts, Cameras, Laser Sensors, Sensors, Actuators, Embedded Linux, NVIDIA Jetson Concepts, Real-Time Workloads, GPU Acceleration, Robot Bring-Up",
        "project_edits": {
            1: "Emphasized Linux-based physical hardware, sensors, actuators, control interfaces, testing, and robot bring-up.",
            0: "Emphasized GPU-accelerated perception, camera/LiDAR processing, and real-time robotics outputs.",
        },
        "keywords": ["C++", "Python", "ROS", "ROS2", "hardware abstraction layers", "device drivers", "cameras", "laser sensors", "sensors", "actuators", "embedded Linux", "NVIDIA Jetson", "real-time workloads", "GPU acceleration", "robot bring-up", "perception", "testing", "hardware interfaces"],
        "target": 95,
        "confirm": [*COMMON_CONFIRM, "Relocation to Columbus, Ohio: Yes."],
        "gap": "Production HAL/device-driver ownership, cross-compilation, Jetson deployment, and three to six years of professional experience are not verified. The package qualifies these as concepts while emphasizing real hardware, Linux, sensing, controls, and ROS/Gazebo work.",
    },
    {
        "folder": "laminar-plc-integration-engineer",
        "company": "Laminar",
        "role": "PLC Integration Engineer",
        "location": "Somerville, MA - Hybrid",
        "url": "https://jobs.lever.co/runlaminar/7bfc5681-fbb0-4204-8510-3eb0b0be6181/apply",
        "listingUrl": "https://jobs.lever.co/runlaminar/7bfc5681-fbb0-4204-8510-3eb0b0be6181",
        "summary": "Robotics and automation engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Hands-on experience with Python, expert Linux, Git/GitHub, sensors, edge-device concepts, system integration, industrial automation, basic PLC/control logic, networking fundamentals, TCP/IP, data logging, diagnostics, root-cause analysis, documentation, and hardware-software troubleshooting.",
        "skills_add": "Role Emphasis: PLC Integration Fundamentals, Industrial Automation, Ethernet/IP Concepts, Modbus Concepts, PROFINET Concepts, IT/OT Networking, IP Addressing, TCP/IP, DNS, NTP, Python Scripting, Linux, Git/GitHub, Edge Devices, Sensors, Root Cause Analysis",
        "project_edits": {
            1: "Emphasized sensor logging, Linux-based hardware, troubleshooting, and repeatable diagnostics.",
            4: "Emphasized honest basic PLC/control logic, sensors, actuators, manufacturing integration, and state tracking.",
        },
        "keywords": ["PLC integration", "industrial automation", "Ethernet/IP", "Modbus", "PROFINET", "IT/OT networking", "IP addressing", "TCP/IP", "DNS", "NTP", "Python scripting", "Linux", "Git/GitHub", "edge devices", "sensors", "root cause analysis", "documentation", "system integration"],
        "target": 95,
        "confirm": [*COMMON_CONFIRM, "Hybrid work in Somerville, Massachusetts: Yes.", "Travel up to 50%: Yes unless the user changes this answer."],
        "gap": "Hands-on production PLC commissioning, SCADA ownership, and direct EtherNet/IP, Modbus, or PROFINET deployment are not verified. The package clearly labels protocol and PLC experience as fundamentals or concepts and emphasizes Linux, Python, networking, sensors, diagnostics, and upcoming industrial automation work.",
    },
    {
        "folder": "cosmic-robotics-software-engineer",
        "company": "Cosmic Robotics",
        "role": "Robotics Software Engineer",
        "location": "San Francisco, CA - On-site",
        "url": "https://jobs.ashbyhq.com/cosmic-robotics/d2a32cb4-b8f1-4622-b170-6e485e214a9f/application",
        "listingUrl": "https://jobs.ashbyhq.com/cosmic-robotics/d2a32cb4-b8f1-4622-b170-6e485e214a9f",
        "summary": "Robotics Software Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Hands-on experience with C/C++, Python, expert Linux, robotic manipulation concepts, navigation, path planning, motor control, sensor integration, safety and reliability, physical robot testing, hardware bring-up, ROS2 concepts, Nav2 concepts, MoveIt concepts, Gazebo simulation, code review, automated testing, and documentation.",
        "skills_add": "Role Emphasis: Robotic Manipulation Concepts, Navigation, Path Planning, Motor Control, Sensor Integration, Safety, Reliability, Hardware Bring-Up, Field Deployment, C++, Python, Linux, ROS2, Nav2 Concepts, MoveIt Concepts, Gazebo",
        "project_edits": {
            1: "Emphasized physical aerial-robot control, sensor integration, safety, reliability, and hardware troubleshooting.",
            2: "Emphasized ROS/Gazebo path planning, trajectory quality, and autonomous navigation validation.",
        },
        "keywords": ["robotic manipulation", "navigation", "path planning", "motor control", "sensor integration", "safety", "reliability", "hardware bring-up", "field deployment", "C++", "Python", "Linux", "ROS2", "Nav2", "MoveIt", "Gazebo", "automated testing", "documentation"],
        "target": 95,
        "confirm": [*COMMON_CONFIRM, "On-site work in San Francisco: Yes.", "Travel to customer projects: Yes unless a specific percentage is unusually high."],
        "gap": "Two years of professional robotics engineering, field deployment, Nav2, MoveIt, and manipulation ownership are not verified. The package labels unverified middleware as concepts and emphasizes physical drone control, motion planning, safety, and simulation.",
    },
    {
        "folder": "trener-software-integration-engineer",
        "company": "Trener Robotics",
        "role": "Integration Engineer (Software Focused)",
        "location": "San Jose, CA - On-site",
        "url": "https://jobs.ashbyhq.com/Trener-Robotics/0a2b9a81-beb7-4e46-9561-87a8946acebb/application",
        "listingUrl": "https://jobs.ashbyhq.com/Trener-Robotics/0a2b9a81-beb7-4e46-9561-87a8946acebb",
        "summary": "Robotics Software and Integration Engineer pursuing an M.S. in Robotics and Autonomous Systems (AI) at Arizona State University, with a B.S. in Computer Science. Hands-on experience with C/C++, Python, ROS2 concepts, sensors, cameras, vision, industrial automation, PLC concepts, motion and path planning, Docker, CAD, robot validation, hardware-software integration, troubleshooting, and technical documentation across physical and simulated robotic systems.",
        "skills_add": "Role Emphasis: C++, Python, ROS2, Robotics Integration, Sensors, Cameras, Vision Systems, PLC Concepts, Conveyors Concepts, Ethernet/IP Concepts, Modbus Concepts, OPC-UA Concepts, Integration Testing, Docker, Motion Planning, Path Planning, CAD",
        "project_edits": {
            1: "Emphasized physical robot sensors, control interfaces, calibration-adjacent validation, and debugging.",
            2: "Emphasized ROS/Gazebo integration testing, motion planning, and repeatable software validation.",
            4: "Emphasized honest PLC/control-logic and industrial automation concepts.",
        },
        "keywords": ["C++", "Python", "ROS2", "robotics integration", "sensors", "cameras", "vision systems", "PLC", "conveyors", "Ethernet/IP", "Modbus", "OPC-UA", "integration testing", "Docker", "motion planning", "path planning", "CAD", "technical documentation"],
        "target": 95,
        "confirm": [*COMMON_CONFIRM, "On-site work in San Jose, California: Yes."],
        "gap": "Direct industrial robot-arm vendor experience, production PLC/peripheral drivers, and industrial protocols are not verified. The package labels those items as concepts and emphasizes the qualifying M.S. program, C++/Python, ROS/Gazebo, physical sensing/control, Docker, CAD, vision, and integration testing.",
    },
]


def write_analysis(role: dict[str, Any], folder: Path) -> None:
    keyword_lines = "\n".join(role["keywords"]) + "\n"
    (folder / "ats-keywords.txt").write_text(keyword_lines, encoding="utf-8")
    analysis = [
        f"# {role['company']} - {role['role']}",
        "",
        f"- Location: {role['location']}",
        f"- Authoritative listing: {role['listingUrl']}",
        f"- Application: {role['url']}",
        "",
        "## Keyword Gap Analysis",
        "",
        role["gap"],
        "",
        "## Package Notes",
        "",
        "- Existing verified education, projects, experience, dates, and metrics are preserved.",
        "- Tailoring changes emphasis and wording; it does not invent experience.",
        "- ATS alignment is a local phrase-coverage heuristic, not an employer ATS result.",
        "",
        "## Confirmed Or Manual-Check Answers",
        "",
        *[f"- {item}" for item in role["confirm"]],
        "",
    ]
    (folder / "package-analysis.md").write_text("\n".join(analysis), encoding="utf-8")


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


def build_atomic_portfolio(builder: Any, folder: Path) -> tuple[Path, list[Path]]:
    out = folder / "George_Jobi_Portfolio.pdf"
    styles = {
        "name": ParagraphStyle(
            "portfolio-name",
            fontName=builder.BOLD,
            fontSize=15,
            leading=17,
            alignment=TA_CENTER,
            spaceAfter=2,
        ),
        "contact": ParagraphStyle(
            "portfolio-contact",
            fontName=builder.REGULAR,
            fontSize=9.2,
            leading=10.5,
            alignment=TA_CENTER,
            spaceAfter=7,
        ),
        "heading": ParagraphStyle(
            "portfolio-heading",
            fontName=builder.BOLD,
            fontSize=10.3,
            leading=11.5,
            spaceBefore=5,
            spaceAfter=1,
        ),
        "title": ParagraphStyle(
            "portfolio-title",
            fontName=builder.BOLD,
            fontSize=9.2,
            leading=10.5,
            spaceBefore=4,
            spaceAfter=1,
        ),
        "body": ParagraphStyle(
            "portfolio-body",
            fontName=builder.REGULAR,
            fontSize=8.65,
            leading=10.2,
            spaceAfter=2,
        ),
        "bullet": ParagraphStyle(
            "portfolio-bullet",
            fontName=builder.REGULAR,
            fontSize=8.55,
            leading=10.05,
            leftIndent=10,
            firstLineIndent=-7,
            spaceAfter=1.4,
        ),
    }

    def para(text: str, style: str) -> Paragraph:
        return Paragraph(text, styles[style])

    def heading(text: str) -> list[Any]:
        return [
            para(text, "heading"),
            HRFlowable(
                width="100%",
                thickness=1.1,
                color=colors.black,
                spaceBefore=0,
                spaceAfter=4,
            ),
        ]

    story: list[Any] = [
        para("GEORGE JOBI PERANGATTU", "name"),
        para(
            "Robotics Software &amp; Autonomous Systems Project Portfolio | "
            "gjobiper@asu.edu | (480) 742-9855 | "
            "linkedin.com/in/george-j-1829112a2/",
            "contact",
        ),
        *heading("TECHNICAL PROFILE"),
        para(
            "M.S. student in Robotics and Autonomous Systems (AI) at Arizona State "
            "University with a completed B.S. in Computer Science. Project work spans "
            "camera-LiDAR perception, state estimation, physical robot control, motion "
            "planning, simulation, sensor integration, testing, and manufacturing automation.",
            "body",
        ),
        *heading("SELECTED PROJECTS"),
        para(
            "Efficient TransFuser: Camera-LiDAR Sensor Fusion for Localization &amp; Perception",
            "title",
        ),
        para(
            "&bull; Replaced the TransFuser backbone with EfficientNetV2-S, reducing "
            "parameters by 70% from 168M to 50M while improving held-out loss by 8.7%.",
            "bullet",
        ),
        para(
            "&bull; Built multi-scale transformer fusion for RGB images and LiDAR point "
            "clouds, improving BEV segmentation by 25.4% across perception and localization tasks.",
            "bullet",
        ),
        para(
            "&bull; Developed PyTorch data, training, and evaluation pipelines for detection, "
            "depth estimation, mapping, navigation, and segmentation in CARLA; diagnosed and "
            "resolved an FP16 focal-loss instability.",
            "bullet",
        ),
        para("Parrot MiniDrone: Real-Time Localization &amp; Autonomous Control", "title"),
        para(
            "&bull; Implemented closed-loop PID control for yaw, velocity, and altitude on "
            "physical hardware using inertial and visual sensor fusion for real-time state estimation.",
            "bullet",
        ),
        para(
            "&bull; Built automated test sequences, sensor logging, performance evaluation, "
            "safety checks, and failsafes for repeatable autonomous operation.",
            "bullet",
        ),
        para("3D Motion Planning for Autonomous Navigation in Gazebo", "title"),
        para(
            "&bull; Developed a Python 3D RRT planner integrated with ROS and Gazebo for "
            "collision-free path generation; evaluated and post-processed trajectories across "
            "multiple environments.",
            "bullet",
        ),
        para("Spider CAD Robot &amp; Factory Automation", "title"),
        para(
            "&bull; Designed a multi-legged robot with constrained joints, kinematic checks, "
            "actuator placement, and a URDF-ready path toward ROS/Gazebo validation.",
            "bullet",
        ),
        para(
            "&bull; Preparing an industrial automation simulation integrating sensors, actuators, "
            "state tracking, and basic PLC/control logic for semiconductor-process workflows.",
            "bullet",
        ),
        *heading("PRODUCTION SOFTWARE EVIDENCE"),
        para(
            "&bull; DigiClips Media: built Python/PyTorch data and ML pipelines handling 10M+ "
            "daily queries, reducing latency by 45%, and improved computer-vision accuracy by 30%.",
            "bullet",
        ),
        para(
            "&bull; Odoo and TicketDex: delivered production backend and full-stack improvements, "
            "including testing infrastructure and a 30% latency reduction.",
            "bullet",
        ),
        Spacer(1, 2),
        para(
            "<b>Core tools:</b> C/C++, Python, ROS/ROS2 concepts, Linux/Ubuntu, PyTorch, "
            "OpenCV, Gazebo, CARLA, Git, CMake, Docker, CI/CD, sensors, actuators, PID control, "
            "motion planning, computer vision, state estimation, and sensor fusion.",
            "body",
        ),
    ]
    doc = SimpleDocTemplate(
        str(out),
        pagesize=letter,
        leftMargin=0.5 * inch,
        rightMargin=0.5 * inch,
        topMargin=0.4 * inch,
        bottomMargin=0.4 * inch,
    )
    doc.build(story)
    previews = builder.render_png(out, "portfolio-preview")
    return out, previews


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build preserved-layout application packages without regenerating unrelated approved files."
    )
    parser.add_argument(
        "--folder",
        action="append",
        default=[],
        help="Build only the matching role folder. Repeat for multiple roles.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    builder = load_builder()
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    reference_pages = builder.render_png(REFERENCE, "reference-kforce")
    summary = []

    selected_roles = ROLES
    if args.folder:
        requested = set(args.folder)
        selected_roles = [role for role in ROLES if role["folder"] in requested]
        missing = sorted(requested - {role["folder"] for role in selected_roles})
        if missing:
            raise ValueError(f"Unknown role folder(s): {', '.join(missing)}")

    for role in selected_roles:
        resume = builder.render_resume(role)
        folder = resume.parent
        write_analysis(role, folder)
        previews = builder.render_png(resume, "resume-preview")
        approval_preview = folder / "approval-preview.png"
        build_approval_preview(role["company"], role["role"], previews, approval_preview)
        comparison = folder / "format-comparison-page-1.png"
        builder.compare(reference_pages[0], previews[0], comparison)
        validation = folder / "validation-report.json"
        run_checked([
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
        ])
        portfolio = None
        portfolio_previews: list[Path] = []
        if role["company"] == "Atomic Semi":
            portfolio, portfolio_previews = build_atomic_portfolio(builder, folder)
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
            "--out",
            str(manifest),
        ]
        if portfolio:
            manifest_command.extend(["--attachment", str(portfolio)])
        run_checked(manifest_command)
        report = json.loads(validation.read_text(encoding="utf-8"))
        summary.append({
            "company": role["company"],
            "role": role["role"],
            "location": role["location"],
            "listingUrl": role["listingUrl"],
            "applicationUrl": role["url"],
            "resume": str(resume),
            "previewPages": [str(path) for path in previews],
            "approvalPreview": str(approval_preview),
            "portfolio": str(portfolio) if portfolio else None,
            "portfolioPreviewPages": [str(path) for path in portfolio_previews],
            "formatComparison": str(comparison),
            "analysis": str(folder / "package-analysis.md"),
            "validation": str(validation),
            "approvalManifest": str(manifest),
            "ats": report["keywordCoverage"],
            "pageFillRatios": report["pageFillRatios"],
            "confirm": role["confirm"],
        })

    summary_path = OUT_ROOT / "package-summary.json"
    merged_summary = summary
    if args.folder and summary_path.exists():
        existing = json.loads(summary_path.read_text(encoding="utf-8"))
        by_folder = {
            Path(item["resume"]).parent.name: item
            for item in existing
        }
        for item in summary:
            by_folder[Path(item["resume"]).parent.name] = item
        merged_summary = list(by_folder.values())
    summary_path.write_text(
        json.dumps(merged_summary, indent=2) + "\n", encoding="utf-8"
    )
    checklist = [
        "# June 2026 Ten-Application Approval Checklist",
        "",
        "Approval applies only to the exact PDF hashes recorded below.",
        "",
    ]
    for item in summary:
        manifest = json.loads(Path(item["approvalManifest"]).read_text(encoding="utf-8"))
        resume_hash = manifest["files"]["resume"]["sha256"]
        checklist.extend([
            f"## {item['company']} - {item['role']}",
            "",
            f"- Resume: `{item['resume']}`",
            f"- SHA-256: `{resume_hash}`",
            f"- Estimated ATS alignment: {item['ats']['estimatedAtsAlignment']}% (local heuristic)",
            f"- Page fill: {item['pageFillRatios']['values']}",
            "- [ ] I reviewed page 1 and page 2.",
            "- [ ] The emphasized skills and experience are truthful.",
            "- [ ] The formatting, bold hierarchy, and content preservation are approved.",
            "- [ ] I approve this exact PDF for this company and role.",
            "",
        ])
        if item.get("portfolio"):
            portfolio_record = manifest["files"]["attachments"][0]
            checklist.extend([
                f"- Portfolio: `{item['portfolio']}`",
                f"- Portfolio SHA-256: `{portfolio_record['sha256']}`",
                "- [ ] I reviewed and approve the exact project portfolio.",
                "",
            ])
    checklist.extend([
        "## Final Package Checks",
        "",
        "- [ ] All ten resumes preserve the existing education, projects, employment, dates, and verified metrics.",
        "- [ ] All ten use the exact filename `George_Jobi_Resume.pdf`.",
        "- [ ] I understand the ATS values are transparent local estimates, not employer ATS guarantees.",
        "- [ ] I authorize submission of every role-specific package checked above.",
        "",
    ])
    (OUT_ROOT / "approval-checklist.md").write_text(
        "\n".join(checklist), encoding="utf-8"
    )
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
