import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { cli } from 'cleye'
import fsExists from 'fs.promises.exists'
import prompts from 'prompts'
import task from 'tasuku'
import pc from 'picocolors'

const cliArgV = cli({
  name: 'creact-clerk',
  flags: {
    projectPath: {
      type: String,
      alias: 'p',
      description: 'Project path',
    },
    template: {
      type: String,
      alias: 't',
      description: 'Template',
    },
  },
  parameters: ['[projectPath]'],
})

const cwd = process.cwd()

type Framework = {
  name: string
  display: string
  variants: FrameworkVariant[]
}
type FrameworkVariant = {
  name: string
  display: string
  customCommand?: string
}

const FRAMEWORKS: Framework[] = [
  {
    name: 'nextjs',
    display: 'Next.js',
    variants: [
      {
        name: 'app-router',
        display: 'App router',
      },
      {
        name: 'pages-router',
        display: 'Pages router',
      },
    ],
  },
  // Add more templates
]

async function copy(src: string, dest: string) {
  const stat = await fs.stat(src)
  if (stat.isDirectory()) {
    copyDir(src, dest)
  } else {
    await fs.copyFile(src, dest)
  }
}

async function copyDir(srcDir: string, destDir: string) {
  await fs.mkdir(destDir, { recursive: true })
  for (const file of await fs.readdir(srcDir)) {
    const srcFile = path.resolve(srcDir, file)
    const destFile = path.resolve(destDir, file)
    copy(srcFile, destFile)
  }
}

function formatTargetDir(targetDir: string | undefined) {
  return targetDir?.trim().replaceAll(/\/+$/g, '')
}

const DEFAULT_DIR = 'clerk-app'

async function init() {
  const argTargetDir = formatTargetDir(cliArgV._.projectPath)
  const argTemplate = cliArgV.flags.template

  if (cliArgV.flags.help) {
    cliArgV.showHelp()
    return
  }

  let targetDir = argTargetDir || DEFAULT_DIR
  let template = argTemplate || 'nextjs-app-router'

  let result: prompts.Answers<'projectPath' | 'framework' | 'variant'>

  try {
    result = await prompts([
      {
        type: 'text',
        name: 'projectPath',
        message: 'Project path',
        initial: DEFAULT_DIR,
        onState: (state) => {
          targetDir = formatTargetDir(state.value) || DEFAULT_DIR
        },
      },
      {
        type: 'select',
        name: 'framework',
        message: `Which framework do you want to use?`,
        initial: 0,
        choices: FRAMEWORKS.map((framework) => ({
          title: framework.display,
          value: framework,
        })),
      },
      {
        type: 'select',
        name: 'variant',
        message: 'Which variant do you want to use?',
        choices: (prev: Framework) => {
          return prev.variants.map((variant: FrameworkVariant) => ({
            title: variant.display,
            value: variant,
          }))
        },
      },
      // Add package manager selection and install dependencies
    ])
  } catch (error) {
    console.error(error)
    return
  }

  const { framework, variant } = result

  template = template || `${framework.name}-${variant.name}`

  const root = path.join(cwd, targetDir)

  const renameFiles: Record<string, string | undefined> = {
    _gitignore: '.gitignore',
  }

  task(
    `Start creating a new Clerk app in ${root}...`,
    async ({ setTitle, setOutput }) => {
      const rootExists = await fsExists(root)

      setTitle(pc.bold('Initializing project...'))

      if (!rootExists) {
        await fs.mkdir(root, { recursive: true })
      }

      const templateDir = path.resolve(
        fileURLToPath(import.meta.url),
        '../..',
        `templates/${template}`,
      )

      const write = async (file: string, content?: string) => {
        const targetPath = path.join(root, renameFiles[file] ?? file)
        if (content) {
          await fs.writeFile(targetPath, content)
        } else {
          await copy(path.join(templateDir, file), targetPath)
        }
      }

      const files = await fs.readdir(templateDir)
      for (const file of files) {
        await write(file)
      }

      setOutput(`
Project ${framework.display} (${framework.variant}) with Clerk 🍪 created in ${targetDir} directory 🚀

🔒 Next steps:

${pc.green('$')}  cd ${targetDir}
${pc.green('$')}  npm install
`)
    },
  )
}

init().catch((error) => {
  console.error(error)
})
