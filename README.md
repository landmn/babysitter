<div align="center">

# Babysitter

https://a5c.ai

---

[![npm version](https://img.shields.io/npm/v/@a5c-ai/babysitter-sdk.svg)](https://www.npmjs.com/package/@a5c-ai/babysitter-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub issues](https://img.shields.io/github/issues/a5c-ai/babysitter.svg)](https://github.com/a5c-ai/babysitter/issues)
[![GitHub stars](https://img.shields.io/github/stars/a5c-ai/babysitter.svg)](https://github.com/a5c-ai/babysitter/stargazers)

> **Orchestrate complex, multi-step workflows with human-in-the-loop approval, iterative refinement, and quality convergence.**

[Getting Started](#installation) | [Documentation](#documentation) | [Community](#community-and-support)

</div>

---

https://github.com/user-attachments/assets/8c3b0078-9396-48e8-aa43-5f40da30c20b

---

## Table of Contents

- [What is Babysitter?](#what-is-babysitter)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [First Steps](#first-steps)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Why Babysitter?](#why-babysitter)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Community and Support](#community-and-support)
- [License](#license)

---

## What is Babysitter?

Babysitter is an orchestration framework for Claude Code that enables deterministic, event-sourced workflow management. It allows you to build complex, multi-step development processes with built-in quality gates, human approval checkpoints, and automatic iteration until quality targets are met. Babysitter works seamlessly with your existing subagents, skills, and tools, orchestrating them into sophisticated workflows.

---

## Prerequisites

- **Node.js**: Version 20.0.0+ (22.x LTS recommended)
- **Claude Code**: Latest version ([docs](https://code.claude.com/docs/en/quickstart))
- **Git**: For cloning (optional)

---

## Installation

### 1. Install the Plugin

```bash
claude plugin marketplace add a5c-ai/babysitter
claude plugin install --scope user babysitter@a5c.ai
```

Then restart Claude Code.

### 2. Verify Installation

Type `/skills` in Claude Code to verify "babysit" appears.

### Codex CLI Integration (babysitter-codex)

Codex support is available as a dedicated plugin bundle in:

`plugins/babysitter-codex`

It includes Codex hook wiring, slash command dispatch, and orchestration harness scripts compatible with the Babysitter SDK.

---

## First Steps

After installation, set up your environment:

### 1. Configure Your Profile (One-Time)

```bash
/babysitter:user-install
```

This creates your personal profile with:
- Breakpoint preferences (how much oversight you want)
- Tool preferences and communication style
- Expertise areas for better process matching

### 2. Set Up Your Project

```bash
/babysitter:project-install
```

This analyzes your codebase and configures:
- Project-specific workflows
- Test frameworks and CI/CD integration
- Tech stack preferences

### 3. Verify Setup

```bash
/babysitter:doctor
```

Run diagnostics to confirm everything is working.

---

## Quick Start

```bash
claude "/babysitter:call implement user authentication with TDD"
```

Or in natural language:

```
Use the babysitter skill to implement user authentication with TDD
```

Claude will create an orchestration run, execute tasks step-by-step, handle quality checks and approvals, and continue until completion.

### Choose Your Mode

| Mode | Command | When to Use |
|------|---------|-------------|
| **Interactive** | `/babysitter:call` | Learning, critical workflows - pauses for approval |
| **Autonomous** | `/babysitter:yolo` | Trusted tasks - full auto, no breakpoints |
| **Planning** | `/babysitter:plan` | Review process before executing |
| **Continuous** | `/babysitter:forever` | Monitoring, periodic tasks - runs indefinitely |

### Utility Commands

| Command | Purpose |
|---------|----------|
| `/babysitter:doctor` | Diagnose run health and issues |
| `/babysitter:observe` | Launch real-time monitoring dashboard |
| `/babysitter:resume` | Continue an interrupted run |

---

## How It Works

```
+=============================================================================+
|                         PROCESS ENFORCEMENT                                  |
+=============================================================================+
|                                                                              |
|  YOUR REQUEST                         YOUR PROCESS DEFINITION (JavaScript)   |
|  +-----------------------+            +----------------------------------+   |
|  | "Build REST API       |            | defineProcess('tdd-api', {       |   |
|  |  with TDD, 80% quality"|           |   phases: [                      |   |
|  +-----------+-----------+            |     { id: 'research',            |   |
|              |                        |       tasks: [analyzeCodebase,   |   |
|              v                        |                createSpecs] },   |   |
|  +-----------------------+            |     { id: 'implement',           |   |
|  | Babysitter selects or |            |       tasks: [writeTests,        |   |
|  | generates process     |----------->|                writeCode] },     |   |
|  +-----------------------+            |     { id: 'verify',              |   |
|                                       |       gates: [testsPass,         |   |
|                                       |                coverage80] }     |   |
|  DETERMINISTIC EXECUTION              |   ],                             |   |
|  (Process drives every step)          |   onGateFail: 'refine'           |   |
|                                       | })                               |   |
|  Phase: research                      +----------------------------------+   |
|  +---------------------------+                     |                         |
|  | [x] analyzeCodebase       |<--------------------+                         |
|  | [x] createSpecs           |     Process defines WHAT runs                 |
|  +-------------+-------------+                                               |
|                |                                                             |
|  Phase: implement                                                            |
|  +-------------v-------------+                                               |
|  | [x] writeTests            |     Babysitter enforces WHEN and HOW          |
|  | [x] writeCode             |                                               |
|  +-------------+-------------+                                               |
|                |                                                             |
|  Phase: verify                                                               |
|  +-------------v-------------+                                               |
|  | Gate: testsPass?     [x]  |     Quality gates defined IN the process      |
|  | Gate: coverage >= 80% [x] |---> COMPLETE                                  |
|  +---------------------------+                                               |
|         | (gate fails)                                                       |
|         v                                                                    |
|  Process-defined refinement          JOURNAL (Event-Sourced)                 |
|  (not a retry - a defined phase)     +-------------------------------+       |
|                                      | Every task recorded immutably |       |
|                                      | Deterministic replay anytime  |       |
|                                      | Resume exactly where stopped  |       |
|                                      +-------------------------------+       |
+=============================================================================+
```

**Key Concepts:**
- **Process Enforcement:** Your workflow is defined in code - Babysitter enforces every step
- **Deterministic Execution:** Same process definition = same execution sequence
- **Quality Gates:** Standards defined in the process, not as an afterthought
- **Event-Sourced Journal:** All state in `.a5c/runs/` - deterministic replay and resume

---

## Why Babysitter?

| Traditional Approach | Babysitter |
|---------------------|------------|
| Run script once, hope it works | Process enforces quality gates before completion |
| Manual approval via chat | Structured breakpoints with context |
| State lost on session end | Event-sourced, fully resumable |
| Single task execution | Parallel execution, dependencies |
| No audit trail | Complete journal of all events |
| Ad-hoc workflow | Deterministic, code-defined processes |

**Key differentiators:** Process enforcement, deterministic replay, quality convergence, human-in-the-loop breakpoints, and parallel execution.

---

## Documentation

### Getting Started
- [Quickstart Guide](docs/user-guide/getting-started/quickstart.md)
- [Beginner Tutorial: REST API](docs/user-guide/tutorials/beginner-rest-api.md)
- [Best Practices](docs/user-guide/BEST-PRACTICES.md)

### Features
- [Process Library](docs/user-guide/features/process-library.md) - 2,000+ pre-built processes
- [Process Definitions](docs/user-guide/features/process-definitions.md)
- [Quality Convergence](docs/user-guide/features/quality-convergence.md)
- [Run Resumption](docs/user-guide/features/run-resumption.md)
- [Journal System](docs/user-guide/features/journal-system.md)
- [Best Practices](docs/user-guide/features/best-practices.md)
- [Architecture Overview](docs/user-guide/features/architecture-overview.md)

### Reference
- [FAQ](docs/user-guide/reference/faq.md)
- [Troubleshooting](docs/user-guide/reference/troubleshooting.md)
- [Security](docs/user-guide/reference/security.md)
- [CLI Reference](docs/user-guide/reference/cli-reference.md)

---

## Contributing

We welcome contributions! Here's how you can help:

- **Report bugs**: [GitHub Issues](https://github.com/a5c-ai/babysitter/issues)
- **Suggest features**: Share your ideas for improvements
- **Submit pull requests**: Fix bugs or add features
- **Improve documentation**: Help make docs clearer

See [CONTRIBUTING.md](https://github.com/a5c-ai/babysitter/blob/main/CONTRIBUTING.md) for detailed guidelines.

---

## Community and Support

- **Discord**: [Join our community](https://discord.gg/dHGkzxf48a) *(GitHub invite link)*
- **GitHub Issues**: [Report bugs or request features](https://github.com/a5c-ai/babysitter/issues)
- **GitHub Discussions**: [Ask questions and share ideas](https://github.com/a5c-ai/babysitter/discussions)
- **npm**: [@a5c-ai/babysitter-sdk](https://www.npmjs.com/package/@a5c-ai/babysitter-sdk)

### Community Tools

| Tool | Description |
|------|-------------|
| [Observer Dashboard](https://github.com/yoavmayer/babysitter-observer-dashboard) | Real-time monitoring UI for parallel runs |
| [Telegram Bot](https://github.com/a5c-ai/claude-code-telegram-bot) | Control sessions remotely |
| [vibe-kanban](https://github.com/BloopAI/vibe-kanban) | Parallel process management |

### Star History

<a href="https://star-history.com/#a5c-ai/babysitter&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=a5c-ai/babysitter&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=a5c-ai/babysitter&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=a5c-ai/babysitter&type=Date" />
 </picture>
</a>

### Contributors

<a href="https://github.com/a5c-ai/babysitter/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=a5c-ai/babysitter" />
</a>

---

## License

This project is licensed under the **MIT License**. See [LICENSE.md](https://github.com/a5c-ai/babysitter/blob/main/LICENSE.md) for details.

---

<div align="center">

**Built with Claude by A5C AI**

[Back to Top](#babysitter)

</div>
