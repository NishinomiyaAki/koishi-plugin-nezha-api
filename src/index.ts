import { Context, Logger, Schema, h } from 'koishi'
import { } from '@koishijs/plugin-server'
import { isIP } from 'node:net'

declare module 'koishi' {
  interface Tables {
    nezha_site: NezhaSite
    nezha_site_v1: NezhaSiteV1
  }
}

export interface NezhaSite {
  userId: number
  url: string
  token: string
}

const ValidTypes = ['v0', 'v1', 'komari'] as const
type SiteType = typeof ValidTypes[number]
function isSiteType(type: string): type is SiteType {
  return ValidTypes.includes(type as SiteType)
}

export interface NezhaSiteV1 {
  userId: number
  type: SiteType
  url: string
  token: string
  username: string
  password: string
}

export const name = 'nezha-api'
export const inject = {
  required: ['database'],
  optional: ['server'],
}

export const logger = new Logger('nezha-api')

export interface Config {
  responseTimeout: number;
  showChangedData: boolean;
  channelRecall: boolean;
  recallTime: number;
  aliveThreshold: number;
  alertNotify: {
    enable: boolean;
    path: string;
    bodyContent: {
      Nezha: string;
      Komari: string;
    };
  };
}

export const Config: Schema<Config> = Schema.object({
  responseTimeout: Schema.number()
    .default(15000)
    .min(5000)
    .max(60000)
    .step(1000)
    .description('交互式输入时，等待消息回复的时间（单位为毫秒）'),
  showChangedData: Schema.boolean()
    .default(true)
    .description('站点数据发生改动时，返回的消息中是否包含数据改动'),
  channelRecall: Schema.boolean()
    .default(true)
    .description('是否开启群聊自动撤回'),
  recallTime: Schema.number()
    .default(15000)
    .min(5000)
    .max(60000)
    .step(1000)
    .description('群聊自动撤回的延迟时间（单位为毫秒）'),
  aliveThreshold: Schema.number()
    .default(300)
    .min(5)
    .max(3600)
    .step(1)
    .description('判断服务器是否在线的时间间隔（单位为秒）'),
  alertNotify: Schema.object({
    enable: Schema.boolean()
      .default(true)
      .description('是否开启告警通知监听'),
    path: Schema.string()
      .default('/nezha/notify')
      .description('告警通知监听路径'),
    bodyContent: Schema.object({
      Nezha: Schema.string()
        .default(`# 探针通知\\n\\n时间：#DATETIME#\\n\\n#NEZHA#`)
        .description('Nezha面板使用的告警通知内容模板'),
      Komari: Schema.string()
        .default(`# 探针通知\\n\\n{{title}}\\n{{message}}`)
        .description('Komari面板使用的告警通知内容模板'),
    })
      .description('告警通知请求的body参数内容')
  })
    .description('告警通知')
})

export const usage = `
## 使用说明

### 指令：nezha
* 基本语法：\`nezha\`
* 指令功能：输出插件的简易信息

### 指令：nezha help
* 基本语法：\`nezha help\`
* 指令功能：等价于 \`help nezha\`

### 指令：nezha add
* 基本语法：\`nezha add <type:string> [url:string] [input1:string] [input2:string]\`
* 指令功能：添加 \`NezhaV0\` / \`NezhaV1\` / \`Komari\` 站点的 \`url\` 和 \`token\` / \`username\` & \`password\` 至数据库，请确保 \`url\` 和 \`token\` / \`username\` & \`password\` 均有效
* 使用限制：**仅私聊可用**，支持交互式输入

### 指令：nezha delete/del
* 基本语法：\`nezha del <type:string>\`
* 指令功能：删除已保存的站点数据
* 使用限制：**仅私聊可用**，支持交互式输入

### 指令：nezha url
* 基本语法：\`nezha url <type:string> [url:string]\`
* 指令功能：修改数据库中记录的指定类型的站点 \`url\` ，请确保已使用 \`nezha add\` 添加过数据
* 使用限制：**仅私聊可用**，支持交互式输入

### 指令：nezha token
* 基本语法：\`nezha url [token:string]\`
* 指令功能：修改数据库中记录 \`NezhaV0\` 的站点 \`token\` ，请确保已使用 \`nezha add\` 添加过数据
* 使用限制：**仅私聊可用**，支持交互式输入

### 指令：nezha info
* 基本语法：\`nezha info\`
* 指令功能：查看数据库中记录的所有站点 \`url\` 和 \`token\` / \`username\` & \`password\`
* 使用限制：**仅私聊可用**

### 指令：nezha all
* 基本语法：\`nezha all [type:string] [tag:string]\`
* 指令功能：获取 \`tag\` 分组下所有服务器的统计数据摘要，留空则返回所有数据，当且仅当 \`tag\` 为 \`untagged\` 时返回未分组的数据
* 使用限制：\`tag\` 参数仅支持 \`NezhaV0\` 站点

### 指令：nezha list
* 基本语法：\`nezha list [type:string] [tag:string]\`
* 指令功能：获取 \`tag\` 分组下所有服务器的状态信息摘要，留空则返回所有数据，当且仅当 \`tag\` 为 \`untagged\` 时返回未分组的数据
* 使用限制：\`tag\` 参数仅支持 \`NezhaV0\` 站点

### 指令：nezha id
* 基本语法：\`nezha id <type:string> [id:number]\`
* 指令功能：获取ID为 \`id\` 的服务器详细信息
* 使用限制：仅支持 \`NezhaV0\` 和 \`NezhaV1\` 站点，支持交互式输入

### 指令：nezha uuid
* 基本语法：\`nezha uuid [uuid:string]\`
* 指令功能：获取UUID为 \`uuid\` 的服务器详细信息
* 使用限制：仅支持 \`Komari\` 站点，支持交互式输入

### 指令：nezha search
* 基本语法：\`nezha search <name:string>\`
* 指令功能：搜索所有站点中名称包含关键字 \`name\` 的服务器状态信息摘要

### 指令：nezha notify
* 基本语法：\`nezha notify <type:string>\`
* 指令功能：**需要公网部署**，获取不同站点的告警通知请求的部分参数，便于新增通知方式
`

export function apply(ctx: Context, config: Config) {
  // ctx.model.extend('nezha_site', {
  //   userId: 'unsigned',
  //   url: 'string',
  //   token: 'string',
  // }, {
  //   primary: ['userId']
  // })

  ctx.model.extend('nezha_site_v1', {
    userId: 'unsigned',
    type: 'string',
    url: 'string',
    token: 'string',
    username: 'string',
    password: 'string',
  }, {
    primary: ['userId', 'type']
  })

  const layerName = 'nezha-notify'
  const processRequest = async (_ctx, next) => {
    _ctx.body = "OK"
    const { platform, userId, groupId, content } = _ctx.request.body
    if (platform && (userId || groupId) && content) {
      for (let bot of ctx.bots) {
        if (bot.platform === platform) {
          try {
            if (groupId && userId) {
              await bot.sendMessage(groupId, h('at', { id: userId }) + '<br/>' + content)
            } else if (userId) {
              await bot.sendPrivateMessage(userId, h.parse(content))
            }
          } catch (error) {
            logger.error(error)
          }
        }
      }
    }
    return next()
  }

  ctx.on('ready', () => {
    if (config.alertNotify.enable && ctx.server) {
      ctx.server.post(layerName, config.alertNotify.path, processRequest)
      if (ctx.database.tables['nezha_site'] !== undefined) {
        ctx.model.migrate('nezha_site', {}, async (database) => {
          const oldData = await database.get('nezha_site', {})
          const newData = oldData.map<NezhaSiteV1>(item => ({
            ...item,
            type: "v0",
            username: "",
            password: ""
          }))
          await database.upsert('nezha_site_v1', newData)
          database.drop('nezha_site')
        })
      }
    }
  })

  ctx.on('dispose', () => {
    if (ctx.server) {
      ctx.server.stack = ctx.server.stack.filter(layer => layer.name !== layerName)
    }
  })

  const truncationUrl = (url: string) => {
    const siteReg = new RegExp('^https?://', 'i')
    url = url.replace(siteReg, '')
    while (url.endsWith('/')) {
      url = url.substring(0, url.length - 1)
    }
    return url
  }

  const mainCmd = ctx.command('nezha', '用于查询哪吒站点服务器详细信息')
    .action(async ({ session }) => {
      const { id, name } = await ctx.database.getUser(session.platform, session.userId, ['id', "name"])
      const datas = await ctx.database.get('nezha_site_v1', { userId: id })
      datas.sort((a, b) => ValidTypes.indexOf(a.type) - ValidTypes.indexOf(b.type))

      let details = [
        `Hi ${name || session.author.nick || session.author.name || session.username}!`,
        '此插件用于查询哪吒面板服务器详细信息',
        '免责声明：',
        '本机器人保证您敏感信息的安全性。',
        '请自行知悉潜在风险。',
        '===========================',
      ]
      if (datas !== undefined && datas.length > 0) {
        details.push('您的哪吒面板是：')
        for (let i = 0; i < datas.length; i++) {
          const data = datas[i]
          details.push(`- ${data.type}：${truncationUrl(data.url)}`)
        }
        details.push('使用 nezha all 开始统计数据摘要吧！')
      } else {
        details.push('没有保存的数据。')
        details.push('使用 nezha add 开始添加你的站点数据！')
      }
      await sendQueuedWithRecall(session, details.join('\n'))
      return
    })

  mainCmd.subcommand('.help', '获取 nezha 相关指令的帮助信息')
    .action(async ({ session }) => {
      return session.execute('help nezha')
    })

  const checkValid = (input) => { return typeof input === 'string' && input.length !== 0 }
  const processType = async (session, inputType): Promise<string | { type: SiteType, bUseToken: boolean }> => {
    if (!isSiteType(inputType)) {
      session.sendQueued(`请输入站点类型，支持的类型有：${ValidTypes.join(', ')}`)
      inputType = await session.prompt(config.responseTimeout)
      if (!isSiteType(inputType)) {
        return '站点类型输入超时或无效'
      }
    }
    return { type: inputType, bUseToken: inputType === "v0" }
  }
  const processUrl = async (session, inputUrl): Promise<string | { url: string }> => {
    if (!checkValid(inputUrl)) {
      session.sendQueued('站点地址无效，请重新输入站点地址')
      inputUrl = await session.prompt(config.responseTimeout)
      if (!checkValid(inputUrl)) {
        return '站点地址输入超时'
      }
    }
    const siteReg = new RegExp('^https?://', 'g')
    if (!siteReg.test(inputUrl)) {
      return '站点地址必须以 http:// 或 https:// 开头'
    }
    return { url: inputUrl }
  }
  const processToken = async (session, inputToken): Promise<string | { token: string }> => {
    if (!checkValid(inputToken)) {
      session.sendQueued('请输入站点Token')
      inputToken = await session.prompt(config.responseTimeout)
      if (!checkValid(inputToken)) {
        return '站点Token输入超时'
      }
    }
    return { token: inputToken }
  }
  const processUsername = async (session, inputUsername): Promise<string | { username: string }> => {
    if (!checkValid(inputUsername)) {
      session.sendQueued('请输入用户名')
      inputUsername = await session.prompt(config.responseTimeout)
      if (!checkValid(inputUsername)) {
        return '用户名输入超时'
      }
    }
    return { username: inputUsername }
  }
  const processPassword = async (session, inputPassword): Promise<string | { password: string }> => {
    if (!checkValid(inputPassword)) {
      session.sendQueued('请输入密码')
      inputPassword = await session.prompt(config.responseTimeout)
      if (!checkValid(inputPassword)) {
        return '密码输入超时'
      }
    }
    return { password: inputPassword }
  }
  const inChannel = async (platform, channelId) => {
    const channelData = await ctx.database.getChannel(platform, channelId)
    return channelData !== undefined
  }

  const getQueuedMessageId = (sendResult) => {
    return Array.isArray(sendResult) ? sendResult[0] : sendResult
  }

  const sendQueuedWithRecall = async (session, content: string) => {
    const sendResult = await session.sendQueued(content)
    const msgId = getQueuedMessageId(sendResult)
    if (msgId && await inChannel(session.platform, session.channelId) && config.channelRecall) {
      ctx.setTimeout(async () => {
        try {
          await session.bot.deleteMessage(session.channelId, msgId)
        } catch (error) {
          logger.warn(error)
        }
      }, config.recallTime)
    }
    return sendResult
  }

  mainCmd.subcommand('.add <type:string> [url:string] [input1:string] [input2:string]', '添加站点数据')
    .example('nezha add TYPE URL TOKEN|USERNAME PASSWORD')
    .action(async ({ session }, type, url, input1, input2) => {
      if (await inChannel(session.platform, session.channelId)) {
        return '该指令仅限私聊可用'
      }

      const procTypeRes = await processType(session, type)
      if (typeof procTypeRes === 'string') {
        return procTypeRes
      }

      const { id } = await ctx.database.getUser(session.platform, session.userId, ['id'])
      const [data] = await ctx.database.get('nezha_site_v1', { userId: id, type: procTypeRes.type })

      const procUrlRes = await processUrl(session, url)
      if (typeof procUrlRes === 'string') {
        return procUrlRes
      }

      let procTokenRes = null
      let procUsernameRes = null
      let procPasswordRes = null
      if (procTypeRes.type === 'v0') {
        procTokenRes = await processToken(session, input1)
        if (typeof procTokenRes === 'string') {
          return procTokenRes
        }
      } else {
        procUsernameRes = await processUsername(session, input1)
        if (typeof procUsernameRes === 'string') {
          return procUsernameRes
        }
        procPasswordRes = await processPassword(session, input2)
        if (typeof procPasswordRes === 'string') {
          return procPasswordRes
        }
      }


      if (data === undefined) {
        await ctx.database.create('nezha_site_v1', {
          userId: id,
          type: procTypeRes.type,
          url: procUrlRes.url,
          token: procTokenRes !== null ? procTokenRes.token : '',
          username: procUsernameRes !== null ? procUsernameRes.username : '',
          password: procPasswordRes !== null ? procPasswordRes.password : '',
        })
        let retMsg = '站点数据添加成功'
        if (config.showChangedData) {
          retMsg += `\n🔗保存的站点地址：${procUrlRes.url}`
          if (procTypeRes.bUseToken) {
            retMsg += `\n🔑保存的站点Token：${procTokenRes.token}`
          } else {
            retMsg += `\n👤保存的用户名：${procUsernameRes.username}\n🔒保存的密码：${procPasswordRes.password}`
          }
        }
        return retMsg
      }
      else {
        session.sendQueued('检测到站点数据已存在，是否覆盖原有数据(Y/n)?')
        const confirmRes = await session.prompt(config.responseTimeout)
        if (checkValid(confirmRes) && (confirmRes === 'Y' || confirmRes === 'y')) {
          await ctx.database.set('nezha_site_v1', { userId: id, type: procTypeRes.type }, {
            url: procUrlRes.url,
            token: procTokenRes !== null ? procTokenRes.token : '',
            username: procUsernameRes !== null ? procUsernameRes.username : '',
            password: procPasswordRes !== null ? procPasswordRes.password : '',
          })
          let retMsg = '站点数据修改成功'
          if (config.showChangedData) {
            retMsg += `\n🔗站点地址：${truncationUrl(data.url)} ➡ ${procUrlRes.url}`
            if (procTypeRes.bUseToken) {
              retMsg += `\n🔑站点Token：${data.token} ➡ ${procTokenRes.token}`
            } else {
              retMsg += `\n👤用户名：${data.username} ➡ ${procUsernameRes.username}\n🔒密码：${data.password} ➡ ${procPasswordRes.password}`
            }
          }
          return retMsg
        } else {
          return '操作已取消'
        }
      }
    })

  mainCmd.subcommand('.delete <type:string>', '删除已保存的站点数据')
    .alias('.del')
    .example('nezha delete TYPE')
    .action(async ({ session }, type) => {
      if (await inChannel(session.platform, session.channelId)) {
        return '该指令仅限私聊可用'
      }

      const procTypeRes = await processType(session, type)
      if (typeof procTypeRes === 'string') {
        return procTypeRes
      }

      const { id } = await ctx.database.getUser(session.platform, session.userId, ['id'])
      const [data] = await ctx.database.get('nezha_site_v1', { userId: id, type: procTypeRes.type })
      if (data !== undefined) {
        await ctx.database.remove('nezha_site_v1', { userId: id, type: procTypeRes.type })
        let retMsg = '站点数据删除成功'
        if (config.showChangedData) {
          retMsg += `\n🔗删除的站点地址：${truncationUrl(data.url)}`
          if (procTypeRes.bUseToken) {
            retMsg += `\n🔑删除的站点Token：${data.token}`
          } else {
            retMsg += `\n👤删除的用户名：${data.username}\n🔒删除的密码：${data.password}`
          }
        }
        return retMsg
      } else {
        return '没有站点数据可供删除，请先使用 nezha add 添加站点数据'
      }
    })

  mainCmd.subcommand('.url <type:string> [url:string]', '更新站点地址')
    .option('url', '站点地址')
    .action(async ({ session }, type, url) => {
      const channelData = await ctx.database.getChannel(session.platform, session.channelId)
      if (channelData !== undefined) {
        return '该指令仅限私聊可用'
      }

      const procTypeRes = await processType(session, type)
      if (typeof procTypeRes === 'string') {
        return procTypeRes
      }

      const { id } = await ctx.database.getUser(session.platform, session.userId, ['id'])
      const [data] = await ctx.database.get('nezha_site_v1', { userId: id, type: procTypeRes.type })
      if (data !== undefined) {
        const procUrlRes = await processUrl(session, url)
        if (typeof procUrlRes === 'string') {
          return procUrlRes
        } else {
          await ctx.database.set('nezha_site_v1', { userId: id }, { url: procUrlRes.url })
          let retMsg = '站点地址更新成功'
          if (config.showChangedData) {
            retMsg += `\n🔗站点地址：${truncationUrl(data.url)} ➡ ${procUrlRes.url}`
          }
          return retMsg
        }
      } else {
        return '没有站点数据可供更新，请先使用 nezha add 添加站点数据'
      }
    })

  mainCmd.subcommand('.token', '更新站点Token')
    .option('token', '站点Token')
    .action(async ({ session }, token) => {
      const channelData = await ctx.database.getChannel(session.platform, session.channelId)
      if (channelData !== undefined) {
        return '该指令仅限私聊可用'
      }
      const { id } = await ctx.database.getUser(session.platform, session.userId, ['id'])
      const [data] = await ctx.database.get('nezha_site_v1', { userId: id, type: "v0" })
      if (data !== undefined) {
        const procTokenRes = await processToken(session, token)
        if (typeof procTokenRes === 'string') {
          return procTokenRes
        } else {
          await ctx.database.set('nezha_site_v1', { userId: id, type: "v0" }, { token: procTokenRes.token })
          let retMsg = '站点Token更新成功'
          if (config.showChangedData) {
            retMsg += `\n🔑站点Token：${data.token} ➡ ${procTokenRes.token}`
          }
          return retMsg
        }
      } else {
        return '没有站点数据可供更新，请先使用 nezha add 添加站点数据'
      }
    })

  mainCmd.subcommand('.info', '查看站点地址和Token')
    .action(async ({ session }) => {
      if (await inChannel(session.platform, session.channelId)) {
        return '该指令仅限私聊可用'
      }
      const { id } = await ctx.database.getUser(session.platform, session.userId, ['id'])
      const datas = await ctx.database.get('nezha_site_v1', { userId: id })
      datas.sort((a, b) => ValidTypes.indexOf(a.type) - ValidTypes.indexOf(b.type))
      if (datas !== undefined && datas.length > 0) {
        let retMsg = '这是您保存的站点数据：'
        for (let i = 0; i < datas.length; i++) {
          const data = datas[i]
          retMsg += `\n - ${data.type}：\n   🔗站点地址：${truncationUrl(data.url)}`
          if (data.type === "v0") {
            retMsg += `\n   🔑站点Token：${data.token}`
          } else {
            retMsg += `\n   👤用户名：${data.username}\n   🔒密码：${data.password}`
          }
        }
        return retMsg
      } else {
        return '没有站点数据可供查询，请先使用 nezha add 添加站点数据'
      }
    })

  const listPath = '/api/v1/server/list'
  const detailsPath = '/api/v1/server/details'
  const untagged = 'untagged'

  const buildUrl = (baseUrl: string, path: string): string => {
    baseUrl = baseUrl.trim()
    while (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.substring(0, baseUrl.length - 1)
    }
    return baseUrl + path
  }

  const buildHeader = (token: string) => {
    let header = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36'
    }
    if (token !== '') {
      header['Authorization'] = token
    }
    return header
  }

  const getListPath = (data: NezhaSiteV1) => {
    if (data.type === "v0") {
      return buildUrl(data.url, '/api/v1/server/list')
    }
    if (data.type === "v1") {
      return buildUrl(data.url, '/api/v1/server')
    }
    if (data.type === "komari") {
      return buildUrl(data.url, '/api/nodes')
    }
    return '未知的站点类型'
  }

  const getDetailsPath = (data: NezhaSiteV1) => {
    if (data.type === "v0") {
      return buildUrl(data.url, '/api/v1/server/details')
    }
    if (data.type === "v1") {
      return buildUrl(data.url, '/api/v1/server')
    }
    if (data.type === "komari") {
      return buildUrl(data.url, '/api/nodes')
    }
    return '未知的站点类型'
  }

  const isServerAlive = (lastActive) => {
    let timeNow = Math.floor(Date.now() / 1000)
    return timeNow - lastActive < config.aliveThreshold
  }

  const getCpuCoreNum = (cpuInfos) => {
    let totalCoreNum = 0
    if (cpuInfos && cpuInfos.length !== 0) {
      for (let i = 0; i < cpuInfos.length; i++) {
        const cpuInfo = cpuInfos[i] as string
        const cpuInfoArr = cpuInfo.split(' ')
        if (cpuInfoArr.length >= 3) {
          const coreNum = Number(cpuInfoArr[cpuInfoArr.length - 3])
          if (!Number.isNaN(coreNum)) {
            totalCoreNum += coreNum
          }
        }
      }
    }
    return totalCoreNum
  }

  const naturalsize = (value: number, fractionDigits: number = 1) => {
    const base = 1024
    const suffixes = "KMGTPEZY"
    const absValue = Math.abs(value)
    let unit, suffix
    for (let i = 0; i < suffixes.length; i++) {
      unit = base ** (i + 2)
      suffix = suffixes[i]
      if (absValue < unit)
        break
    }
    return (base * value / unit).toFixed(fractionDigits) + suffix
  }

  const percentage = (value: number) => {
    value = Math.min(Math.abs(value), 1)
    return (value * 100).toFixed(2) + '%'
  }

  const getNow = () => {
    return new Intl.DateTimeFormat('zh-CN', {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
      timeZone: "Asia/Shanghai",
      timeZoneName: "longOffset"
    }).format(new Date(Date.now())).replaceAll('/', '-')
  }

  const authenticate = async (data: NezhaSiteV1): Promise<{ success: boolean, token: string }> => {
    if (data.type === "v0") {
      return { success: true, token: data.token }
    }
    if (data.type === "v1") {
      const res = await ctx.http.post(buildUrl(data.url, '/api/v1/login'), {
        username: data.username,
        password: data.password,
      }).catch((err) => {
        return { success: false, token: err.message }
      })
      if (res !== undefined) {
        if ('error' in res) {
          return { success: false, token: `访问站点失败，错误信息：${res.error}` }
        }
        if ('success' in res && res.success === true) {
          return { success: true, token: `Bearer ${res.data.token}` }
        }
      }
      return { success: false, token: '认证失败，请检查用户名和密码。' }
    }
    if (data.type === "komari") {
      return { success: true, token: '' }
    }
    return { success: false, token: '未知的站点类型' }
  }

  const checkResponse = (type: SiteType, res) => {
    if (type === "v0") {
      if ('code' in res && 'message' in res) {
        if (res.code !== 0) {
          return { success: false, message: res.message }
        }
        if ('result' in res) {
          if (res.result.length === 0) {
            return { success: false, message: '未检测到服务器' }
          }
          return { success: true, message: '' }
        }
      }
      return { success: false, message: '无法解析的响应数据' }
    }
    if (type === "v1") {
      if ('success' in res && res.success === true) {
        if ('data' in res) {
          if (res.data.length === 0) {
            return { success: false, message: '未检测到服务器' }
          }
          return { success: true, message: '' }
        }
      }
      return { success: false, message: '无法解析的响应数据' }
    }
    if (type === "komari") {
      if ('status' in res && 'message' in res) {
        if (res.status !== 'success') {
          return { success: false, message: res.message }
        }
        if ('data' in res) {
          if (res.data.length === 0) {
            return { success: false, message: '未检测到服务器' }
          }
          return { success: true, message: '' }
        }
      }
      return { success: false, message: '无法解析的响应数据' }
    }
    return { success: false, message: '未知的站点类型' }
  }

  const getKomariLatestStatus = async (data: NezhaSiteV1) => {
    if (data.type !== "komari") {
      return null
    }
    const randomId = Math.floor(Math.random() * 1000)
    const latestStatusRes = await ctx.http.post(buildUrl(data.url, '/api/rpc2'), {
      jsonrpc: "2.0",
      method: "common:getNodesLatestStatus",
      params: {},
      id: randomId
    }).catch((err) => {
      return { error: err.message }
    })
    if (latestStatusRes !== undefined) {
      if ('error' in latestStatusRes) {
        return { success: false, message: `访问站点失败，错误信息：${latestStatusRes.error}` }
      }
      if ('result' in latestStatusRes && latestStatusRes.id === randomId) {
        return { success: true, data: latestStatusRes.result }
      }
    }
    return { success: false, message: '无法解析的响应数据' }
  }

  const generateOverviewInfo = (data: NezhaSiteV1, res, tag, statusData?) => {
    let info = {
      titlePrefix: '',
      serverNum: 0,
      onlineNum: 0,
      cpuTotal: 0,
      memUsage: 0,
      memTotal: 0,
      memUsed: 0,
      swapUsage: 0,
      swapTotal: 0,
      swapUsed: 0,
      diskUsage: 0,
      diskTotal: 0,
      diskUsed: 0,
      netInSpeed: 0,
      netOutSpeed: 0,
      netInTransfer: 0,
      netOutTransfer: 0,
      transParity: 0,
    }
    if (data.type === "v0") {
      if (tag !== '' && tag !== untagged) {
        info.titlePrefix = `[${tag}]分组的`
      }

      for (let i = 0; i < res.result.length; i++) {
        const serverInfo = res.result[i]
        if ((tag !== '' && serverInfo.tag !== tag) && (tag === untagged && serverInfo.tag !== '')) {
          continue
        }
        info.serverNum += 1
        if (isServerAlive(serverInfo.last_active)) {
          info.onlineNum += 1
        }
        info.cpuTotal += getCpuCoreNum(serverInfo.host.CPU)
        info.memTotal += serverInfo.host.MemTotal
        info.memUsed += serverInfo.status.MemUsed
        info.swapTotal += serverInfo.host.SwapTotal
        info.swapUsed += serverInfo.status.SwapUsed
        info.diskTotal += serverInfo.host.DiskTotal
        info.diskUsed += serverInfo.status.DiskUsed
        info.netInTransfer += serverInfo.status.NetInTransfer
        info.netOutTransfer += serverInfo.status.NetOutTransfer
        info.netInSpeed += serverInfo.status.NetInSpeed
        info.netOutSpeed += serverInfo.status.NetOutSpeed
      }
    }
    if (data.type === "v1") {
      for (let i = 0; i < res.data.length; i++) {
        const serverInfo = res.data[i]

        info.serverNum += 1
        if (isServerAlive(new Date(serverInfo.last_active).getTime() / 1000)) {
          info.onlineNum += 1
        }
        info.cpuTotal += getCpuCoreNum(serverInfo.host.cpu)
        info.memTotal += serverInfo.host.mem_total
        info.memUsed += serverInfo.state.mem_used
        info.swapTotal += serverInfo.host.swap_total
        info.swapUsed += serverInfo.state.swap_used
        info.diskTotal += serverInfo.host.disk_total
        info.diskUsed += serverInfo.state.disk_used
        info.netInTransfer += serverInfo.state.net_in_transfer
        info.netOutTransfer += serverInfo.state.net_out_transfer
        info.netInSpeed += serverInfo.state.net_in_speed
        info.netOutSpeed += serverInfo.state.net_out_speed
      }
    }
    if (data.type === "komari") {
      for (let i = 0; i < res.data.length; i++) {
        const serverInfo = res.data[i]
        const serverStatus = statusData[serverInfo.uuid]

        info.serverNum += 1
        if (isServerAlive(new Date(serverInfo.updated_at).getTime() / 1000)) {
          info.onlineNum += 1
        }
        info.cpuTotal += serverInfo.cpu_cores
        info.memTotal += serverInfo.mem_total
        info.memUsed += serverStatus.ram
        info.swapTotal += serverInfo.swap_total
        info.swapUsed += serverStatus.swap
        info.diskTotal += serverInfo.disk_total
        info.diskUsed += serverStatus.disk
        info.netInTransfer += serverStatus.net_total_down
        info.netOutTransfer += serverStatus.net_total_up
        info.netInSpeed += serverStatus.net_in
        info.netOutSpeed += serverStatus.net_out
      }
    }

    info.memUsage = info.memTotal !== 0 ? info.memUsed / info.memTotal : 0
    info.swapUsage = info.swapTotal !== 0 ? info.swapUsed / info.swapTotal : 0
    info.diskUsage = info.diskTotal !== 0 ? info.diskUsed / info.diskTotal : 0
    if (info.netOutTransfer * info.netInTransfer === 0) {
      info.transParity = 0
    } else if (info.netOutTransfer >= info.netInTransfer) {
      info.transParity = info.netInTransfer / info.netOutTransfer
    } else {
      info.transParity = info.netOutTransfer / info.netInTransfer
    }

    return info
  }

  mainCmd.subcommand('.all [type:string] [tag:string]', '获取所有服务器的统计数据摘要')
    .action(async ({ session }, type, tag) => {
      if (tag === undefined) {
        tag = ''
      }

      const { id } = await ctx.database.getUser(session.platform, session.userId, ['id'])
      let query = { userId: id }
      if (type !== undefined) {
        const procTypeRes = await processType(session, type)
        if (typeof procTypeRes === 'string') {
          return procTypeRes
        }
        query['type'] = procTypeRes.type
      }
      const datas = await ctx.database.get('nezha_site_v1', query)
      datas.sort((a, b) => ValidTypes.indexOf(a.type) - ValidTypes.indexOf(b.type))

      if (datas !== undefined && datas.length > 0) {
        let retMsg = []
        for (let i = 0; i < datas.length; i++) {
          const data = datas[i]
          retMsg.push(`- ${data.type}：`)
          const authRes = await authenticate(data)
          if (!authRes.success) {
            retMsg.push(authRes.token)
            continue
          }
          const res = await ctx.http.get(getDetailsPath(data), { headers: buildHeader(authRes.token), params: { tag: tag === untagged ? '' : tag } })
            .catch((err) => {
              return { error: err.message }
            })
          if (res !== undefined) {
            if ('error' in res) {
              retMsg.push(`访问站点失败，错误信息：${res.error}`)
              continue
            }

            const check = checkResponse(data.type, res)
            if (!check.success) {
              retMsg.push(check.message)
              continue
            }

            const komariStatus = await getKomariLatestStatus(data)
            if (data.type === "komari") {
              if (!komariStatus.success) {
                retMsg.push(komariStatus.message)
                continue
              }
            }

            const overviewInfo = generateOverviewInfo(data, res, tag, komariStatus?.data)
            let details = [
              `${overviewInfo.titlePrefix}服务器统计数据摘要`,
              '===========================',
              `服务器数量： ${overviewInfo.serverNum}`,
              `在线服务器： ${overviewInfo.onlineNum}`,
              `CPU核心数： ${overviewInfo.cpuTotal}`,
              `内存： ${percentage(overviewInfo.memUsage)} [${naturalsize(overviewInfo.memUsed)}/${naturalsize(overviewInfo.memTotal)}]`,
              `交换： ${percentage(overviewInfo.swapUsage)} [${naturalsize(overviewInfo.swapUsed)}/${naturalsize(overviewInfo.swapTotal)}]`,
              `磁盘： ${percentage(overviewInfo.diskUsage)} [${naturalsize(overviewInfo.diskUsed)}/${naturalsize(overviewInfo.diskTotal)}]`,
              `下行速度： ↓${naturalsize(overviewInfo.netInSpeed)}/s`,
              `上行速度： ↑${naturalsize(overviewInfo.netOutSpeed)}/s`,
              `下行流量： ↓${naturalsize(overviewInfo.netInTransfer)}`,
              `上行流量： ↑${naturalsize(overviewInfo.netOutTransfer)}`,
              `流量对等性： ${percentage(overviewInfo.transParity)}`,
              ``,
            ]
            retMsg = retMsg.concat(details)
            continue
          }
          retMsg.push('访问站点失败，请联系管理员确认错误信息')
        }

        retMsg.push(`更新于： ${getNow()}`)
        await sendQueuedWithRecall(session, retMsg.join('\n'))
        return
      } else {
        return '没有站点数据可供使用，请先使用 nezha add 添加站点数据'
      }
    })

  const generateDigestInfo = (data: NezhaSiteV1, res, tag) => {
    let info = []
    if (data.type === "v0") {
      let tagArr = []
      let serverNum, offlineNum, dualNum
      serverNum = offlineNum = dualNum = 0
      res.result.sort((a, b) => { return a.id - b.id })
      for (let i = 0; i < res.result.length; i++) {
        const serverInfo = res.result[i]
        if ((tag !== '' && serverInfo.tag !== tag) && (tag === untagged && serverInfo.tag !== '')) {
          continue
        }
        tagArr.push(serverInfo.tag)
        const alive = isServerAlive(serverInfo.last_active)
        serverNum += 1
        offlineNum += alive ? 0 : 1
        dualNum += isDualStackServer(serverInfo.ipv4, serverInfo.ipv6) ? 1 : 0
      }
      info.push(`服务器数量： ${serverNum}`)
      if (tag === '') {
        info.push(`分组的数量： ${Array.from(new Set(tagArr)).length}`)
      }
      info.push(`离线服务器： ${offlineNum}`)
      info.push(`双栈服务器： ${dualNum}`)
    }
    if (data.type === "v1") {
      let serverNum, offlineNum, dualNum
      serverNum = offlineNum = dualNum = 0
      res.data.sort((a, b) => { return a.id - b.id })
      for (let i = 0; i < res.data.length; i++) {
        const serverInfo = res.data[i]
        const alive = isServerAlive(new Date(serverInfo.last_active).getTime() / 1000)
        serverNum += 1
        offlineNum += alive ? 0 : 1
        dualNum += isDualStackServer(serverInfo.geoip.ip.ipv4_addr, serverInfo.geoip.ip.ipv6_addr) ? 1 : 0
      }
      info.push(`服务器数量： ${serverNum}`)
      info.push(`离线服务器： ${offlineNum}`)
      info.push(`双栈服务器： ${dualNum}`)
    }
    if (data.type === "komari") {
      let serverNum, offlineNum
      serverNum = offlineNum = 0
      for (let i = 0; i < res.data.length; i++) {
        const serverInfo = res.data[i]
        serverNum += 1
        offlineNum += isServerAlive(new Date(serverInfo.updated_at).getTime() / 1000) ? 0 : 1
      }
      info.push(`服务器数量： ${serverNum}`)
      info.push(`离线服务器： ${offlineNum}`)
    }
    return info
  }

  const generateListInfo = (data: NezhaSiteV1, res, tag) => {
    let info = {
      titlePrefix: '',
      headerRow: '',
      serverStates: [],
    }
    if (data.type === "v0") {
      if (tag !== '' && tag !== untagged) {
        info.titlePrefix = `[${tag}]分组的`
      }
      info.headerRow = 'ID \t 状态 \t 分组 \t 服务器名'
      res.result.sort((a, b) => { return a.id - b.id })
      for (let i = 0; i < res.result.length; i++) {
        const serverInfo = res.result[i]
        if ((tag !== '' && serverInfo.tag !== tag) && (tag === untagged && serverInfo.tag !== '')) {
          continue
        }
        const alive = isServerAlive(serverInfo.last_active)
        const status = alive ? '❇️在线' : '☠️离线'
        info.serverStates.push(`${serverInfo.id} \t ${status} \t ${serverInfo.tag === '' ? '🈳' : serverInfo.tag} \t ${serverInfo.name}`)
      }
    }
    if (data.type === "v1") {
      info.headerRow = 'ID \t 状态 \t 服务器名'
      res.data.sort((a, b) => { return a.id - b.id })
      for (let i = 0; i < res.data.length; i++) {
        const serverInfo = res.data[i]
        const alive = isServerAlive(new Date(serverInfo.last_active).getTime() / 1000)
        const status = alive ? '❇️在线' : '☠️离线'
        info.serverStates.push(`${serverInfo.id} \t ${status} \t ${serverInfo.name}`)
      }
    }
    if (data.type === "komari") {
      info.headerRow = 'UUID \t 状态 \t 服务器名'
      for (let i = 0; i < res.data.length; i++) {
        const serverInfo = res.data[i]
        const alive = isServerAlive(new Date(serverInfo.updated_at).getTime() / 1000)
        const status = alive ? '❇️在线' : '☠️离线'
        info.serverStates.push(`${serverInfo.uuid} \t ${status} \t ${serverInfo.name}`)
      }
    }
    return info
  }

  mainCmd.subcommand('.list [type:string] [tag:string]', '获取所有服务器的状态信息摘要')
    .action(async ({ session }, type, tag) => {
      if (tag === undefined) {
        tag = ''
      }

      const { id } = await ctx.database.getUser(session.platform, session.userId, ['id'])
      let query = { userId: id }
      if (type !== undefined) {
        const procTypeRes = await processType(session, type)
        if (typeof procTypeRes === 'string') {
          return procTypeRes
        }
        query['type'] = procTypeRes.type
      }
      const datas = await ctx.database.get('nezha_site_v1', query)
      datas.sort((a, b) => ValidTypes.indexOf(a.type) - ValidTypes.indexOf(b.type))

      if (datas !== undefined && datas.length > 0) {
        let retMsg = []
        for (let i = 0; i < datas.length; i++) {
          const data = datas[i]
          retMsg.push(`- ${data.type}：`)
          const authRes = await authenticate(data)
          if (!authRes.success) {
            retMsg.push(authRes.token)
            continue
          }
          const res = await ctx.http.get(getListPath(data), { headers: buildHeader(authRes.token), params: { tag: tag === untagged ? '' : tag } })
            .catch((err) => {
              return { error: err.message }
            })
          if (res !== undefined) {
            if ('error' in res) {
              retMsg.push(`访问站点失败，错误信息：${res.error}`)
              continue
            }

            const check = checkResponse(data.type, res)
            if (!check.success) {
              retMsg.push(check.message)
              continue
            }

            const digestInfo = generateDigestInfo(data, res, tag)
            const listInfo = generateListInfo(data, res, tag)
            let details = [
              `${listInfo.titlePrefix}服务器状态信息摘要`,
              '===========================',
              ...digestInfo,
              '===========================',
              listInfo.headerRow,
              ...listInfo.serverStates,
              '',
            ]
            retMsg = retMsg.concat(details)
            continue
          }
          retMsg.push('访问站点失败，请联系管理员确认错误信息')
        }

        await sendQueuedWithRecall(session, retMsg.join('\n'))
        return
      } else {
        return '没有站点数据可供使用，请先使用 nezha add 添加站点数据'
      }
    })

  const getCountryFlag = (countryCode: string): string => {
    const symbols = ["🇦", "🇧", "🇨", "🇩", "🇪", "🇫", "🇬", "🇭", "🇮", "🇯", "🇰", "🇱", "🇲", "🇳", "🇴", "🇵", "🇶", "🇷",
      "🇸", "🇹", "🇺", "🇻", "🇼", "🇽", "🇾", "🇿"]
    const BASE = "A".charCodeAt(0)
    let res = []
    for (let i = 0; i < countryCode.length; i++) {
      res.push(symbols[countryCode[i].toUpperCase().charCodeAt(0) - BASE])
    }
    return res.join('')
  }

  const maskIPv4 = (ipv4) => {
    if (typeof ipv4 !== 'string' || ipv4 === '' || ipv4.split('.').length !== 4) {
      return '🈳'
    }
    let ipv4Arr = ipv4.split('.')
    for (let i = 2; i < ipv4Arr.length; i++) {
      ipv4Arr[i] = '**'
    }
    return ipv4Arr.join('.')
  }

  const maskIPv6 = (ipv6) => {
    if (typeof ipv6 !== 'string' || ipv6 === '') {
      return '🈳'
    }
    let ipv6Arr = ipv6.split('::')
    if (ipv6Arr.length === 1) {
      ipv6Arr = ipv6.split(':')
      if (ipv6.length !== 8) {
        return '🈳'
      }
      ipv6Arr.splice(4, 4, '**', '**', '**', '**')
      return ipv6Arr.join(':')
    } else if (ipv6Arr.length === 2) {
      let front = ipv6Arr[0].split(':')
      let end = ipv6Arr[1].split(':')
      let maskCount = Math.floor((front.length + end.length) / 2)
      for (let i = end.length - 1; i >= 0; i--) {
        if (maskCount === 0) {
          break
        }
        end[i] = '**'
        maskCount--
      }
      for (let i = front.length - 1; i >= 0; i--) {
        if (maskCount === 0) {
          break
        }
        front[i] = '**'
        maskCount--
      }
      return front.join(':') + '::' + end.join(':')
    } else {
      return '🈳'
    }
  }

  const normalizeIpValue = (value) => {
    if (typeof value !== 'string') {
      return ''
    }
    const normalized = value.trim()
    const lower = normalized.toLowerCase()
    if (normalized === '' || lower === 'null' || lower === 'undefined') {
      return ''
    }
    return normalized
  }

  const hasIPv4Address = (value) => {
    return isIP(normalizeIpValue(value)) === 4
  }

  const hasIPv6Address = (value) => {
    return isIP(normalizeIpValue(value)) === 6
  }

  const isDualStackServer = (ipv4, ipv6) => {
    return hasIPv4Address(ipv4) && hasIPv6Address(ipv6)
  }

  const convertTime = (bootTime) => {
    if (bootTime === 0) {
      return '未运行'
    }
    let timeNow = Math.floor(Date.now() / 1000)
    let time = timeNow - bootTime
    const day = 24 * 60 * 60
    const hour = 60 * 60
    return `${Math.floor(time / day)}天${Math.floor((time % day) / hour)}小时`
  }

  const convertPeriod = (seconds) => {
    if (seconds < 60) {
      return `${seconds}秒`
    }
    const minute = 60
    const hour = 60 * minute
    const day = 24 * hour
    if (seconds < hour) {
      return `${Math.floor(seconds / minute)}分${seconds % minute}秒`
    }
    if (seconds < day) {
      return `${Math.floor(seconds / hour)}时${Math.floor((seconds % hour) / minute)}分`
    }
    return `${Math.floor(seconds / day)}天${Math.floor((seconds % day) / hour)}时`
  }

  const generateDetailsById = (data: NezhaSiteV1, res, serverId) => {
    let details = []
    if (data.type === "v0") {
      const serverInfo = res.result.find((item) => item?.id === serverId)
      if (!serverInfo) {
        return details
      }
      const alive = isServerAlive(serverInfo.last_active)
      const status = alive ? '❇️在线' : '☠️离线'
      let cpuInfo = ''
      if (serverInfo.host.CPU !== null && serverInfo.host.CPU.length !== 0) {
        cpuInfo = serverInfo.host.CPU[0]
      }
      const memTotal = serverInfo.host.MemTotal
      const memUsed = serverInfo.status.MemUsed
      const swapTotal = serverInfo.host.SwapTotal
      const swapUsed = serverInfo.status.SwapUsed
      const diskTotal = serverInfo.host.DiskTotal
      const diskUsed = serverInfo.status.DiskUsed
      const netInTransfer = serverInfo.status.NetInTransfer
      const netOutTransfer = serverInfo.status.NetOutTransfer
      const netInSpeed = serverInfo.status.NetInSpeed
      const netOutSpeed = serverInfo.status.NetOutSpeed
      const memUsage = memTotal !== 0 ? memUsed / memTotal : 0
      const swapUsage = swapTotal !== 0 ? swapUsed / swapTotal : 0
      const diskUsage = diskTotal !== 0 ? diskUsed / diskTotal : 0
      details = [
        `${getCountryFlag(serverInfo.host.CountryCode)} ${serverInfo.name} ${status}`,
        '===========================',
        `id： ${serverId}`,
        `tag： ${serverInfo.tag === '' ? '🈳' : serverInfo.tag}`,
        `ipv4： ${maskIPv4(serverInfo.ipv4)}`,
        `ipv6： ${maskIPv6(serverInfo.ipv6)}`,
        `平台： ${serverInfo.host.Platform} ${serverInfo.host.PlatformVersion}`,
        `CPU信息： ${cpuInfo}`,
        `运行时间： ${convertTime(serverInfo.host.BootTime)}`,
        `负载： ${serverInfo.status.Load1.toFixed(2)} ${serverInfo.status.Load5.toFixed(2)} ${serverInfo.status.Load15.toFixed(2)}`,
        `CPU： ${serverInfo.status.CPU.toFixed(2)}% [${serverInfo.host.Arch}]`,
        `内存： ${percentage(memUsage)} [${naturalsize(memUsed)}/${naturalsize(memTotal)}]`,
        `交换： ${percentage(swapUsage)} [${naturalsize(swapUsed)}/${naturalsize(swapTotal)}]`,
        `磁盘： ${percentage(diskUsage)} [${naturalsize(diskUsed)}/${naturalsize(diskTotal)}]`,
        `流量： ↓${naturalsize(netInTransfer)} ↑${naturalsize(netOutTransfer)}`,
        `网速： ↓${naturalsize(netInSpeed)}/s ↑${naturalsize(netOutSpeed)}/s`,
        `\n更新于： ${getNow()}`,
      ]
    }
    if (data.type === "v1") {
      for (let i = 0; i < res.data.length; i++) {
        const serverInfo = res.data[i]
        if (serverInfo.id !== serverId) {
          continue
        }
        const alive = isServerAlive(new Date(serverInfo.last_active).getTime() / 1000)
        const status = alive ? '❇️在线' : '☠️离线'
        let cpuInfo = ''
        if (serverInfo.host.cpu != null && serverInfo.host.cpu.length !== 0) {
          cpuInfo = serverInfo.host.cpu[0]
        }
        const memTotal = serverInfo.host.mem_total ?? 0
        const memUsed = serverInfo.state.mem_used ?? 0
        const swapTotal = serverInfo.host.swap_total ?? 0
        const swapUsed = serverInfo.state.swap_used ?? 0
        const diskTotal = serverInfo.host.disk_total ?? 0
        const diskUsed = serverInfo.state.disk_used ?? 0
        const netInTransfer = serverInfo.state.net_in_transfer ?? 0
        const netOutTransfer = serverInfo.state.net_out_transfer ?? 0
        const netInSpeed = serverInfo.state.net_in_speed ?? 0
        const netOutSpeed = serverInfo.state.net_out_speed ?? 0
        const memUsage = memTotal !== 0 ? memUsed / memTotal : 0
        const swapUsage = swapTotal !== 0 ? swapUsed / swapTotal : 0
        const diskUsage = diskTotal !== 0 ? diskUsed / diskTotal : 0
        const {
          load_1 = 0,
          load_5 = 0,
          load_15 = 0,
          cpu = 0
        } = serverInfo.state ?? {}
        const arch = serverInfo.host.arch ?? ''
        details = [
          `${getCountryFlag(serverInfo.geoip.country_code ?? '')} ${serverInfo.name} ${status}`,
          '===========================',
          `id： ${serverId}`,
          `ipv4： ${maskIPv4(serverInfo.geoip.ip.ipv4_addr)}`,
          `ipv6： ${maskIPv6(serverInfo.geoip.ip.ipv6_addr)}`,
          `平台： ${serverInfo.host.platform ?? ''} ${serverInfo.host.platform_version ?? ''}`,
          `CPU信息： ${cpuInfo}`,
          `运行时间： ${convertTime(serverInfo.host.boot_time ?? 0)}`,
          `负载： ${load_1.toFixed(2)} ${load_5.toFixed(2)} ${load_15.toFixed(2)}`,
          `CPU： ${cpu.toFixed(2)}% [${arch}]`,
          `内存： ${percentage(memUsage)} [${naturalsize(memUsed)}/${naturalsize(memTotal)}]`,
          `交换： ${percentage(swapUsage)} [${naturalsize(swapUsed)}/${naturalsize(swapTotal)}]`,
          `磁盘： ${percentage(diskUsage)} [${naturalsize(diskUsed)}/${naturalsize(diskTotal)}]`,
          `流量： ↓${naturalsize(netInTransfer)} ↑${naturalsize(netOutTransfer)}`,
          `网速： ↓${naturalsize(netInSpeed)}/s ↑${naturalsize(netOutSpeed)}/s`,
          `\n更新于： ${getNow()}`,
        ]
      }
    }
    return details
  }

  mainCmd.subcommand('.id <type:string> [serverId:integer]', '通过id查询服务器详细信息')
    .action(async ({ session }, type, serverId) => {
      const procTypeRes = await processType(session, type)
      if (typeof procTypeRes === 'string') {
        return procTypeRes
      }
      if (procTypeRes.type === 'komari') {
        return 'komari类型站点仅支持通过UUID查询服务器详情，请使用 nezha uuid 指令。'
      }

      if (serverId === undefined) {
        session.sendQueued('请输入服务器id')
        serverId = Number(await session.prompt(config.responseTimeout))
        if (!Number.isSafeInteger(serverId)) {
          return '参数 id 输入无效，请提供一个整数。'
        }
      }
      const { id } = await ctx.database.getUser(session.platform, session.userId, ['id'])
      const [data] = await ctx.database.get('nezha_site_v1', { userId: id, type: procTypeRes.type })
      if (data !== undefined) {
        const authRes = await authenticate(data)
        if (!authRes.success) {
          return authRes.token
        }
        const res = await ctx.http.get(getDetailsPath(data), { headers: buildHeader(authRes.token), params: { id: serverId } })
          .catch((err) => {
            return { error: err.message }
          })
        if (res !== undefined) {
          if ('error' in res) {
            return `访问站点失败，错误信息：${res.error}`
          }

          const check = checkResponse(data.type, res)
          if (!check.success) {
            return check.message
          }

          const details = generateDetailsById(data, res, serverId)
          if (details.length === 0) {
            return `未找到ID为 ${serverId} 的服务器。`
          }
          await sendQueuedWithRecall(session, details.join('\n'))
          return
        }
        return `访问站点失败，请联系管理员确认错误信息`
      } else {
        return '没有站点数据可供使用，请先使用 nezha add 添加站点数据'
      }
    })

  const generateDetailsByUUID = (data: NezhaSiteV1, res, statusData, uuid) => {
    let details = []
    if (data.type === "komari") {
      for (let i = 0; i < res.data.length; i++) {
        const serverInfo = res.data[i]
        if (serverInfo.uuid !== uuid) {
          continue
        }
        const serverStatus = statusData[serverInfo.uuid]
        const alive = isServerAlive(new Date(serverInfo.updated_at).getTime() / 1000)
        const status = alive ? '❇️在线' : '☠️离线'
        const memTotal = serverInfo.mem_total
        const memUsed = serverStatus.ram
        const swapTotal = serverInfo.swap_total
        const swapUsed = serverStatus.swap
        const diskTotal = serverInfo.disk_total
        const diskUsed = serverStatus.disk
        const netInTransfer = serverStatus.net_total_down
        const netOutTransfer = serverStatus.net_total_up
        const netInSpeed = serverStatus.net_in
        const netOutSpeed = serverStatus.net_out
        const memUsage = memTotal !== 0 ? memUsed / memTotal : 0
        const swapUsage = swapTotal !== 0 ? swapUsed / swapTotal : 0
        const diskUsage = diskTotal !== 0 ? diskUsed / diskTotal : 0
        details = [
          `${serverInfo.region} ${serverInfo.name} ${status}`,
          '===========================',
          `uuid： ${uuid}`,
          `平台： ${serverInfo.os}`,
          `CPU信息： ${serverInfo.cpu_name}`,
          `运行时间： ${convertPeriod(serverStatus.uptime)}`,
          `负载： ${serverStatus.load.toFixed(2)} ${serverStatus.load5.toFixed(2)} ${serverStatus.load15.toFixed(2)}`,
          `CPU： ${serverStatus.cpu.toFixed(2)}% [${serverInfo.arch}]`,
          `内存： ${percentage(memUsage)} [${naturalsize(memUsed)}/${naturalsize(memTotal)}]`,
          `交换： ${percentage(swapUsage)} [${naturalsize(swapUsed)}/${naturalsize(swapTotal)}]`,
          `磁盘： ${percentage(diskUsage)} [${naturalsize(diskUsed)}/${naturalsize(diskTotal)}]`,
          `流量： ↓${naturalsize(netInTransfer)} ↑${naturalsize(netOutTransfer)}`,
          `网速： ↓${naturalsize(netInSpeed)}/s ↑${naturalsize(netOutSpeed)}/s`,
          `\n更新于： ${getNow()}`,
        ]
      }
    }
    return details
  }

  mainCmd.subcommand('.uuid [uuid:string]', '通过uuid查询服务器详细信息')
    .action(async ({ session }, uuid) => {
      if (uuid === undefined) {
        session.sendQueued('请输入服务器UUID')
        uuid = await session.prompt(config.responseTimeout)
        if (!checkValid(uuid)) {
          return '参数 uuid 输入无效，请提供一个合法的UUID。'
        }
      }
      const { id } = await ctx.database.getUser(session.platform, session.userId, ['id'])
      const [data] = await ctx.database.get('nezha_site_v1', { userId: id, type: 'komari' })
      if (data !== undefined) {
        const authRes = await authenticate(data)
        if (!authRes.success) {
          return authRes.token
        }
        const res = await ctx.http.get(getDetailsPath(data), { headers: buildHeader(authRes.token) })
          .catch((err) => {
            return { error: err.message }
          })
        if (res !== undefined) {
          if ('error' in res) {
            return `访问站点失败，错误信息：${res.error}`
          }

          const check = checkResponse(data.type, res)
          if (!check.success) {
            return check.message
          }

          const komariStatus = await getKomariLatestStatus(data)
          if (!komariStatus.success) {
            return komariStatus.message
          }

          const details = generateDetailsByUUID(data, res, komariStatus?.data, uuid)
          if (details.length === 0) {
            return `未找到UUID为 ${uuid} 的服务器。`
          }
          await sendQueuedWithRecall(session, details.join('\n'))
          return
        }
        return `访问站点失败，请联系管理员确认错误信息`
      } else {
        return '没有站点数据可供使用，请先使用 nezha add 添加站点数据'
      }
    })

  const searchInfoByName = (data: NezhaSiteV1, res, name) => {
    let info = {
      headerRow: '',
      results: [],
    }
    if (data.type === "v0") {
      info.headerRow = 'ID \t 状态 \t 分组 \t 服务器名'
      res.result.sort((a, b) => { return a.id - b.id })
      for (let i = 0; i < res.result.length; i++) {
        const serverInfo = res.result[i]
        if (serverInfo.name.indexOf(name) === -1) {
          continue
        }
        const alive = isServerAlive(serverInfo.last_active)
        const status = alive ? '❇️在线' : '☠️离线'
        info.results.push(`${serverInfo.id} \t ${status} \t ${serverInfo.tag === '' ? '🈳' : serverInfo.tag} \t ${serverInfo.name}`)
      }
    }
    if (data.type === "v1") {
      info.headerRow = 'ID \t 状态 \t 服务器名'
      res.data.sort((a, b) => { return a.id - b.id })
      for (let i = 0; i < res.data.length; i++) {
        const serverInfo = res.data[i]
        if (serverInfo.name.indexOf(name) === -1) {
          continue
        }
        const alive = isServerAlive(new Date(serverInfo.last_active).getTime() / 1000)
        const status = alive ? '❇️在线' : '☠️离线'
        info.results.push(`${serverInfo.id} \t ${status} \t ${serverInfo.name}`)
      }
    }
    if (data.type === "komari") {
      info.headerRow = 'UUID \t 状态 \t 服务器名'
      for (let i = 0; i < res.data.length; i++) {
        const serverInfo = res.data[i]
        if (serverInfo.name.indexOf(name) === -1) {
          continue
        }
        const alive = isServerAlive(new Date(serverInfo.updated_at).getTime() / 1000)
        const status = alive ? '❇️在线' : '☠️离线'
        info.results.push(`${serverInfo.uuid} \t ${status} \t ${serverInfo.name}`)
      }
    }
    if (info.results.length === 0) {
      info.results.push(`没有找到名称包含\"${name}\"的服务器`)
    }
    return info
  }

  mainCmd.subcommand('.search <name:string>', '搜索服务器名称')
    .action(async ({ session }, name) => {
      if (name === undefined) {
        session.sendQueued('请输入搜索关键词')
        name = await session.prompt(config.responseTimeout)
        if (!checkValid(name)) {
          return '关键词输入超时'
        }
      }

      const { id } = await ctx.database.getUser(session.platform, session.userId, ['id'])
      const datas = await ctx.database.get('nezha_site_v1', { userId: id })
      datas.sort((a, b) => ValidTypes.indexOf(a.type) - ValidTypes.indexOf(b.type))

      if (datas !== undefined && datas.length > 0) {
        let retMsg = []
        for (let i = 0; i < datas.length; i++) {
          const data = datas[i]
          retMsg.push(`- ${data.type}：`)
          const authRes = await authenticate(data)
          if (!authRes.success) {
            retMsg.push(authRes.token)
            continue
          }
          const res = await ctx.http.get(getListPath(data), { headers: buildHeader(authRes.token) })
            .catch((err) => {
              return { error: err.message }
            })
          if (res !== undefined) {
            if ('error' in res) {
              retMsg.push(`访问站点失败，错误信息：${res.error}`)
              continue
            }

            const check = checkResponse(data.type, res)
            if (!check.success) {
              retMsg.push(check.message)
              continue
            }

            const info = searchInfoByName(data, res, name)
            let details = [
              `服务器搜索结果`,
              '===========================',
              info.headerRow,
              ...info.results,
              '',
            ]
            retMsg = retMsg.concat(details)
            continue
          }
          retMsg.push('访问站点失败，请联系管理员确认错误信息')
        }

        await sendQueuedWithRecall(session, retMsg.join('\n'))
        return
      } else {
        return '没有站点数据可供使用，请先使用 nezha add 添加站点数据'
      }
    })

  mainCmd.subcommand('.notify <type:string>', '获取告警通知请求的部分参数')
    .action(async ({ session }, type) => {
      if (!config.alertNotify.enable) {
        return '告警通知未启用'
      }
      const procTypeRes = await processType(session, type)
      if (typeof procTypeRes === 'string') {
        return procTypeRes
      }
      const isNezha = procTypeRes.type !== 'komari'
      let message = []
      if (isNezha) {
        message = [
          `URL：http(s)://YOUR_KOISHI_SITE${config.alertNotify.path}`,
          '请求方式：POST',
          '请求类型：JSON',
          'Body:',
          '{',
          `  "platform": "${session.platform}",`,
          `  "userId": "${session.userId}",`,
          `  "groupId": "${session.guildId}",`,
          `  "content": "${config.alertNotify.bodyContent.Nezha}"`,
          '}',
        ]
      } else {
        message = [
          `url：http(s)://YOUR_KOISHI_SITE${config.alertNotify.path}`,
          'method：POST',
          'content_type：application/json',
          'body:',
          '{',
          `  "platform": "${session.platform}",`,
          `  "userId": "${session.userId}",`,
          `  "groupId": "${session.guildId}",`,
          `  "content": "${config.alertNotify.bodyContent.Komari}"`,
          '}',
        ]
      }

      if (!session.guildId) {
        message.splice(7, 1)
      }
      return message.join('\n')
    })
}
