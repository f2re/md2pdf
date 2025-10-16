# Contributing to md2pdf

We love your input! We want to make contributing to this project as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## 🛠️ Development Process

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn package manager
- Python 3 (for PDF post-processing features)

### Setting Up Your Development Environment

1. Fork the repo and create your branch from `main`
   ```bash
   git clone https://github.com/your-username/md2pdf.git
   cd md2pdf
   git checkout -b feature-or-bugfix-name
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run tests to ensure everything is working:
   ```bash
   npm test
   ```

### Making Changes

1. Make your changes to the code
2. Add tests if applicable
3. Ensure all tests pass:
   ```bash
   npm test
   ```
4. Update documentation as necessary
5. Commit your changes using conventional commit messages:
   ```bash
   git add .
   git commit -m "feat: add new PDF styling option"
   ```

## 🐛 Report Bugs

We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/hqsrawmelon/md2pdf/issues/new); it's that easy!

### Write Bug Reports With Detail, Background, and Sample Code

Great Bug Reports tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

## 🚀 Pull Requests

Pull requests are the way we handle code contributions. We follow these guidelines:

1. **Small pull requests** for small changes are preferred
2. **Descriptive titles** that follow conventional commit format
3. **Detailed descriptions** explaining the changes
4. **All tests must pass** before your PR will be merged
5. **One feature/fix per PR** - keep them focused
6. **Update documentation** if adding new features

### Pull Request Process

1. Ensure any install or build dependencies are removed before the end of the layer when doing a build.
2. Update the README.md with details of changes to the interface, this includes new environment variables, exposed ports, useful file locations and container parameters.
3. Increase the version numbers in any examples files and the README.md to the new version that this Pull Request would represent.
4. You may merge the Pull Request in once you have the sign-off of two other developers, or if you do not have permission to do that, you may request the second reviewer to merge it for you.

## 🎨 Style Guide

### JavaScript/Node.js
- Use semicolons
- Use 2 spaces for indentation
- Use descriptive variable and function names
- Follow existing code patterns in the project
- Use JSDoc for public functions

### Markdown
- Use proper heading hierarchy
- Follow GitHub Flavored Markdown standards
- Use descriptive alt text for images

### Git Commit Messages
- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests after the first line

## 📚 Documentation

Help us keep our documentation up to date! When contributing:

- Update README.md if you're changing user-facing functionality
- Add comments to complex code sections
- Ensure all new features are documented

### Multiple Languages
We support multiple languages in our documentation:
- English (main documentation in README.md)
- Russian (in README_RU.md)
- When adding new features, please update documentation in both languages

## 🤝 Code of Conduct

Please read and follow our [Code of Conduct](./CODE_OF_CONDUCT.md) to ensure a welcoming environment for everyone.

## 🎉 Thank You

Thank you for considering contributing to md2pdf! Your efforts help make this project better for everyone.