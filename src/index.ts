import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { cli } from 'cleye'
import prompts from 'prompts'
import { fileURLToPath } from 'node:url'

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

type ColorFunc = (str: string | number) => string
type Framework = {
  name: string
  display: string
  color?: ColorFunc
  variants: FrameworkVariant[]
}
type FrameworkVariant = {
  name: string
  display: string
  color?: ColorFunc
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
]

function copy(src: string, dest: string) {
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    copyDir(src, dest)
  } else {
    fs.copyFileSync(src, dest)
  }
}

function copyDir(srcDir: string, destDir: string) {
  fs.mkdirSync(destDir, { recursive: true })
  for (const file of fs.readdirSync(srcDir)) {
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
  const getProjectName = () => path.basename(path.resolve(targetDir))

  let result: prompts.Answers<'projectName' | 'framework' | 'variant'>

  try {
    result = await prompts([
      {
        type: 'text',
        name: 'projectName',
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
      // Add package manager selection
    ])
  } catch (error) {
    console.error(error)
    return
  }

  const { framework, variant } = result

  const template = `${framework.name}-${variant.name}`

  const root = path.join(cwd, targetDir)

  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true })
  }

  console.log(`Creating a new Clerk app in ${root}...`)

  const templateDir = path.resolve(
    fileURLToPath(import.meta.url),
    '../..',
    `templates/${template}`,
  )

  const renameFiles: Record<string, string | undefined> = {
    _gitignore: '.gitignore',
  }

  const write = (file: string, content?: string) => {
    const targetPath = path.join(root, renameFiles[file] ?? file)
    if (content) {
      fs.writeFileSync(targetPath, content)
    } else {
      copy(path.join(templateDir, file), targetPath)
    }
  }

  const files = fs.readdirSync(templateDir)
  for (const file of files) {
    write(file)
  }
}

init().catch((error) => {
  console.error(error)
})
