# Awesome GitHub Copilot Prompts

A curated collection of custom GitHub Copilot prompt files designed to enhance productivity and streamline development workflows for DevOps engineers and cloud architects.

## 📋 Overview

This directory contains specialized prompt files that extend GitHub Copilot's capabilities for specific use cases. Each prompt is carefully crafted to provide intelligent suggestions and automation for complex tasks related to:

- **Prompt Discovery** - Finding relevant Copilot prompts from the awesome-copilot ecosystem
- **Agent Recommendations** - Suggesting appropriate Copilot agents for your project
- **Collection Management** - Identifying useful Copilot collections and resources
- **Instruction Optimization** - Discovering best-in-class Copilot instructions

## 🗂️ Available Prompts

### 1. **Suggest Awesome GitHub Copilot Prompts**
**File:** `suggest-awesome-github-copilot-prompts.prompt.md`

Analyzes your current repository context and suggests relevant prompt files from the [GitHub awesome-copilot repository](https://github.com/github/awesome-copilot/tree/main/prompts).

**Features:**
- Extracts available prompts from the awesome-copilot registry
- Discovers existing prompts in your local `.github/prompts/` folder
- Compares versions to identify outdated prompts
- Avoids recommending duplicates
- Provides structured recommendations with rationale

**Use Case:** Enhance your prompt library with community-proven additions tailored to your repository's needs.

---

### 2. **Suggest Awesome GitHub Copilot Agents**
**File:** `suggest-awesome-github-copilot-agents.prompt.md`

Identifies and recommends Copilot agents from the awesome-copilot repository that align with your project's technology stack and workflow patterns.

**Features:**
- Analyzes repository context (languages, frameworks, tools)
- Reviews chat history and development patterns
- Matches agents to project needs
- Prevents duplicate agent recommendations
- Provides implementation guidance

**Use Case:** Discover specialized Copilot agents that accelerate specific development tasks in your workflow.

---

### 3. **Suggest Awesome GitHub Copilot Collections**
**File:** `suggest-awesome-github-copilot-collections.prompt.md`

Recommends curated collections from the awesome-copilot ecosystem that complement your repository's technology stack and use cases.

**Features:**
- Scans available collections from awesome-copilot
- Analyzes repository technology and context
- Matches collections to project requirements
- Highlights value-add and differentiation
- Prevents duplicate recommendations

**Use Case:** Organize and extend your Copilot resources through themed collections.

---

### 4. **Suggest Awesome GitHub Copilot Instructions**
**File:** `suggest-awesome-github-copilot-instructions.prompt.md`

Identifies relevant Copilot instructions from the awesome-copilot repository that can enhance AI-assisted development for your specific use cases.

**Features:**
- Catalogs instructions from awesome-copilot registry
- Analyzes local instruction files in `.github/copilot-instructions/`
- Compares versions for updates
- Prevents recommending existing instructions
- Provides installation and customization guidance

**Use Case:** Standardize Copilot behavior and improve AI suggestions across your development team.

---

## 🚀 How to Use

### Basic Usage

1. **Open any prompt file** in your GitHub Copilot chat
2. **Let Copilot analyze** your repository context
3. **Review recommendations** provided in structured tables
4. **Install or update** suggested resources as needed

### Example Workflow

```
User: /awesome-copilot suggest prompts
Copilot: Analyzes your repository and returns a table of recommended prompts
User: Please install [suggested prompt name]
Copilot: Downloads and installs the prompt to `.github/prompts/`
```

### With Devops-Engineer-Profile

These prompts are tailored for DevOps and cloud engineering projects:

- **Terraform & IaC:** Finds prompts for infrastructure code review and documentation
- **Kubernetes & Containers:** Suggests prompts for deployment and configuration management
- **CI/CD Pipelines:** Recommends prompts for pipeline optimization and testing
- **Monitoring & Security:** Identifies prompts for observability and compliance

## 📚 Prompt Features

All prompts in this collection include:

- **YAML Front Matter** - Metadata about the prompt (description, tools, mode)
- **Clear Process Steps** - Detailed instructions for Copilot to follow
- **Context Analysis** - Criteria for evaluating repository needs
- **Structured Output** - Consistent formatting for recommendations
- **Safety Checks** - Built-in validation to prevent duplicates and conflicts
- **Update Detection** - Identifies outdated local versions

## 🔍 Key Capabilities

- ✅ **Smart Analysis** - Understands your repository structure and technology choices
- ✅ **Duplicate Prevention** - Avoids recommending already-installed resources
- ✅ **Version Management** - Detects and suggests updates for outdated resources
- ✅ **Context-Aware** - Considers chat history and development patterns
- ✅ **Structured Recommendations** - Presents options in easy-to-scan tables
- ✅ **Safe Installation** - Requires user approval before making changes

## 📖 Related Resources

- [GitHub awesome-copilot Repository](https://github.com/github/awesome-copilot)
- [GitHub Copilot Documentation](https://docs.github.com/en/copilot)
- [GitHub Copilot Prompts Guide](https://github.com/github/awesome-copilot/blob/main/docs/README.prompts.md)

## 🛠️ Configuration

These prompts work best with:
- **GitHub Copilot** (Chat or IDE integration)
- **Supported IDEs** - VS Code, JetBrains IDEs, Visual Studio, Vim/Neovim
- **Repository Context** - Works with any project type, optimized for DevOps

## 💡 Tips & Best Practices

1. **Regular Reviews** - Run suggestion prompts quarterly to stay updated
2. **Team Alignment** - Share discovered prompts with your team for consistency
3. **Customization** - Modify prompts to match your team's specific standards
4. **Version Control** - Keep prompts in git for tracking and collaboration
5. **Documentation** - Add team-specific notes to prompt descriptions

## 📝 Contributing

To add or improve prompts:

1. Create a new `.prompt.md` file following the YAML front matter convention
2. Include a clear description in the front matter
3. Add detailed process steps and examples
4. Test with your repository context
5. Submit changes via pull request

## 📄 License

These prompts are part of the devops-engineer-profile repository and follow the same license terms.

---

**Last Updated:** January 2026  
**Maintained by:** DevOps Engineering Team
