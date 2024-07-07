import { Context, Logger, Schema, h } from 'koishi'
import {} from '@koishijs/plugin-server'

declare module 'koishi' {
  interface Tables {
    nezha_site: NezhaSite
  }
}

export interface NezhaSite {
  userId: number
  url: string
  token: string
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
    bodyContent: string;
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
    bodyContent: Schema.string()
      .default(`# 探针通知\\n\\n时间：#DATETIME#\\n来自: #SERVER.NAME#\\n\\n#NEZHA#`)
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
* 基本语法：\`nezha add [url:string] [token:string]\`
* 指令功能：添加哪吒站点的url和token至数据库，请确保url和token均有效
* 使用限制：**仅私聊可用**，支持交互式输入

### 指令：nezha url
* 基本语法：\`nezha url [url:string]\`
* 指令功能：修改数据库中记录的站点url，请确保已使用 \`nezha add\` 添加过数据
* 使用限制：**仅私聊可用**，支持交互式输入

### 指令：nezha token
* 基本语法：\`nezha url [token:string]\`
* 指令功能：修改数据库中记录的站点token，请确保已使用 \`nezha add\` 添加过数据
* 使用限制：**仅私聊可用**，支持交互式输入

### 指令：nezha info
* 基本语法：\`nezha info\`
* 指令功能：查看数据库中记录的站点url和token
* 使用限制：**仅私聊可用**

### 指令：nezha all
* 基本语法：\`nezha all [tag:string]\`
* 指令功能：获取 \`tag\` 分组下所有服务器的统计数据摘要，留空则返回所有数据，当且仅当 \`tag\` 为 \`untagged\` 时返回未分组的数据

### 指令：nezha list
* 基本语法：\`nezha list [tag:string]\`
* 指令功能：获取 \`tag\` 分组下所有服务器的状态信息摘要，留空则返回所有数据，当且仅当 \`tag\` 为 \`untagged\` 时返回未分组的数据

### 指令：nezha id
* 基本语法：\`nezha id [id:number]\`
* 指令功能：获取ID为 \`id\` 的服务器详细信息

### 指令：nezha search
* 基本语法：\`nezha search [name:string]\`
* 指令功能：搜索名称包含关键字 \`name\` 的服务器状态信息摘要

### 指令：nezha notify
* 基本语法：\`nezha notify\`
* 指令功能：**需要公网部署**，获取告警通知请求的部分参数，便于新增通知方式
`

export function apply(ctx: Context, config: Config) {
  ctx.model.extend('nezha_site', {
    userId: 'unsigned',
    url: 'string',
    token: 'string',
  }, {
    primary: ['userId']
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
          } catch(error) {
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
    }
  })

  ctx.on('dispose', () => {
    if (ctx.server) {
      ctx.server.stack = ctx.server.stack.filter(layer => layer.name !== layerName)
    }
  })

  const mainCmd = ctx.command('nezha', '用于查询哪吒站点服务器详细信息')
    .action(async ({ session }) => {
      const { id, name } = await ctx.database.getUser(session.platform, session.userId, ['id', "name"])
      const [ data ] = await ctx.database.get('nezha_site', { userId: id })

      let details = [
        `Hi ${name || session.author.nick || session.author.name || session.username}!`,
        '此插件用于查询哪吒面板服务器详细信息，哪吒面板项目文档：',
        'https://nezha.wiki/',
        '免责声明：',
        '本机器人保证您敏感信息的安全性。',
        '请自行知悉潜在风险。',
        '===========================',
      ]
      if (data !== undefined) {
        details.push('您的哪吒面板是：')
        details.push(`${data.url}`)
        details.push('使用 nezha all 开始统计数据摘要吧！')
      } else {
        details.push('没有保存的数据。')
        details.push('使用 nezha add 开始添加你的站点数据！')
      }
      const [ msgId ] = await session.sendQueued(details.join('\n'))
      if (await inChannel(session.platform, session.channelId) && config.channelRecall) {
        ctx.setTimeout(async () => {
          try {
            await session.bot.deleteMessage(session.channelId, msgId)
          } catch (error) {
            logger.warn(error)
          }
        }, config.recallTime)
      }
      return
    })
  
  mainCmd.subcommand('.help', '获取 nezha 相关指令的帮助信息')
    .action(async ({ session }) => {
      return session.execute('help nezha')
    })

  const checkValid = (input) => { return typeof input === 'string' && input.length !== 0 }
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
  const inChannel = async (platform, channelId) => {
    const channelData = await ctx.database.getChannel(platform, channelId)
    return channelData !== undefined
  }

  mainCmd.subcommand('.add [url:string] [token:string]', '添加站点数据')
    .example('nezha add YOUR_URL YOUR_API_TOKEN')
    .action(async ({ session }, url, token) => {
      if (await inChannel(session.platform, session.channelId)) {
        return '该指令仅限私聊可用'
      }
      const { id } = await ctx.database.getUser(session.platform, session.userId, ['id'])
      const [ data ] = await ctx.database.get('nezha_site', { userId: id })

      const procUrlRes = await processUrl(session, url)
      if (typeof procUrlRes === 'string') {
        return procUrlRes
      }

      const procTokenRes = await processToken(session, token)
      if (typeof procTokenRes === 'string') {
        return procTokenRes
      }

      if (data === undefined) {
        await ctx.database.create('nezha_site', {
          userId: id,
          url: procUrlRes.url,
          token: procTokenRes.token,
        })
        let retMsg = '站点数据添加成功'
        if (config.showChangedData) {
          retMsg += `\n🔗保存的站点地址：${procUrlRes.url}\n🔑保存的站点Token：${procTokenRes.token}`
        }
        return retMsg
      }
      else {
        session.sendQueued('检测到站点数据已存在，是否覆盖原有数据(Y/n)?')
        const confirmRes = await session.prompt(config.responseTimeout)
        if (checkValid(confirmRes) && (confirmRes === 'Y' || confirmRes === 'y')) {
          await ctx.database.set('nezha_site', { userId: id }, {
            url: procUrlRes.url,
            token: procTokenRes.token,
          })
          let retMsg = '站点数据修改成功'
          if (config.showChangedData) {
            retMsg += `\n🔗站点地址：${data.url} ➡ ${procUrlRes.url}\n🔑站点Token：${data.token} ➡ ${procTokenRes.token}`
          }
          return retMsg
        } else {
          return '操作已取消'
        }
      }
    })

    mainCmd.subcommand('.delete', '删除已保存的站点数据')
    .alias('.del')
    .action(async ({ session }) => {
      if (await inChannel(session.platform, session.channelId)) {
        return '该指令仅限私聊可用'
      }
      const { id } = await ctx.database.getUser(session.platform, session.userId, ['id'])
      const [ data ] = await ctx.database.get('nezha_site', { userId: id })
      if (data !== undefined) {
        await ctx.database.remove('nezha_site', { userId: id })
        let retMsg = '站点数据删除成功'
        if (config.showChangedData) {
          retMsg += `\n🔗删除的站点地址：${data.url}\n🔑删除的站点Token：${data.token}`
        }
        return retMsg
      } else {
        return '没有站点数据可供删除，请先使用 nezha add 添加站点数据'
      }
    })

  mainCmd.subcommand('.url', '更新站点地址')
  .option('url', '站点地址')
  .action(async ({ session }, url) => {
    const channelData = await ctx.database.getChannel(session.platform, session.channelId)
    if (channelData !== undefined) {
      return '该指令仅限私聊可用'
    }
    const { id } = await ctx.database.getUser(session.platform, session.userId, ['id'])
    const [ data ] = await ctx.database.get('nezha_site', { userId: id })
    if (data !== undefined) {
      const procUrlRes = await processUrl(session, url)
      if (typeof procUrlRes === 'string') {
        return procUrlRes
      } else {
        await ctx.database.set('nezha_site', { userId: id }, { url: procUrlRes.url })
        let retMsg = '站点地址更新成功'
        if (config.showChangedData) {
          retMsg += `\n🔗站点地址：${data.url} ➡ ${procUrlRes.url}`
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
    const [ data ] = await ctx.database.get('nezha_site', { userId: id })
    if (data !== undefined) {
      const procTokenRes = await processToken(session, token)
      if (typeof procTokenRes === 'string') {
        return procTokenRes
      } else {
        await ctx.database.set('nezha_site', { userId: id }, { token: procTokenRes.token })
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
      const [ data ] = await ctx.database.get('nezha_site', { userId: id })
      if (data !== undefined) {
        return `这是您保存的站点数据：\n🔗站点地址：${data.url}\n🔑站点Token：${data.token}`
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
    return {
      'Authorization': token,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36',
    }
  }

  const isServerAlive = (lastActive) => {
    let timeNow = Math.floor(Date.now() / 1000)
    return timeNow - lastActive < config.aliveThreshold
  }

  const getCpuCoreNum = (serverInfo) => {
    const cpuInfos = serverInfo.host.CPU
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

  mainCmd.subcommand('.all [tag:string]', '获取所有服务器的统计数据摘要')
    .action(async ({ session }, tag) => {
      if (tag === undefined) {
        tag = ''
      }
      const { id } = await ctx.database.getUser(session.platform, session.userId, ['id'])
      const [ data ] = await ctx.database.get('nezha_site', { userId: id })
      if (data !== undefined) {
        const res = await ctx.http.get(buildUrl(data.url, detailsPath), { headers: buildHeader(data.token), params: { tag: tag === untagged ? '' : tag } })
          .catch((err) => { 
            return { error: err.message }
          })
        if (res !== undefined) {
          if ('error' in res) {
            return `访问站点失败，错误信息：${res.error}`
          }
          if ('code' in res && 'message' in res) {
            if (res.code !== 0) {
              return res.message
            }
            if ('result' in res) {
              if (res.result.length === 0) {
                return '未检测到服务器'
              }

              let serverNum, onlineNum, cpuTotal, memTotal, memUsed, swapTotal, swapUsed, diskTotal, diskUsed
              serverNum = onlineNum = cpuTotal = memTotal = memUsed = swapTotal = swapUsed = diskTotal = diskUsed = 0
              let netInTransfer, netOutTransfer, netInSpeed, netOutSpeed
              netInTransfer = netOutTransfer = netInSpeed = netOutSpeed = 0
              for (let i = 0; i < res.result.length; i++) {
                const serverInfo = res.result[i]
                if ((tag !== '' && serverInfo.tag !== tag) && (tag === untagged && serverInfo.tag !== '')) {
                  continue
                }
                serverNum += 1
                if (isServerAlive(serverInfo.last_active)) {
                  onlineNum += 1
                }
                cpuTotal += getCpuCoreNum(serverInfo)
                memTotal += serverInfo.host.MemTotal
                memUsed += serverInfo.status.MemUsed
                swapTotal += serverInfo.host.SwapTotal
                swapUsed += serverInfo.status.SwapUsed
                diskTotal += serverInfo.host.DiskTotal
                diskUsed += serverInfo.status.DiskUsed
                netInTransfer += serverInfo.status.NetInTransfer
                netOutTransfer += serverInfo.status.NetOutTransfer
                netInSpeed += serverInfo.status.NetInSpeed
                netOutSpeed += serverInfo.status.NetOutSpeed
              }

              let memUsage = memTotal !== 0 ? memUsed / memTotal : 0
              let swapUsage = swapTotal !== 0 ? swapUsed / swapTotal : 0
              let diskUsage = diskTotal !== 0 ? diskUsed / diskTotal : 0
              let transParity
              if (netOutTransfer * netInTransfer === 0) {
                transParity = 0
              } else if (netOutTransfer >= netInTransfer) {
                transParity = netInTransfer / netOutTransfer
              } else {
                transParity = netOutTransfer / netInTransfer
              }

              let titlePrefix = ''
              if (tag !== '') {
                if (tag === untagged) {
                  titlePrefix = '[默认]分组的'
                } else {
                  titlePrefix = `[${tag}]分组的`
                }
              }
              let details = [
                `${titlePrefix}服务器统计数据摘要`,
                '===========================',
                `服务器数量： ${serverNum}`,
                `在线服务器： ${onlineNum}`,
                `CPU核心数： ${cpuTotal}`,
                `内存： ${percentage(memUsage)} [${naturalsize(memUsed)}/${naturalsize(memTotal)}]`,
                `交换： ${percentage(swapUsage)} [${naturalsize(swapUsed)}/${naturalsize(swapTotal)}]`,
                `磁盘： ${percentage(diskUsage)} [${naturalsize(diskUsed)}/${naturalsize(diskTotal)}]`,
                `下行速度： ↓${naturalsize(netInSpeed)}/s`,
                `上行速度： ↑${naturalsize(netOutSpeed)}/s`,
                `下行流量： ↓${naturalsize(netInTransfer)}`,
                `上行流量： ↑${naturalsize(netOutTransfer)}`,
                `流量对等性： ${percentage(transParity)}`,
                `\n更新于： ${getNow()}`,
              ]
              const [ msgId ] = await session.sendQueued(details.join('\n'))
              if (await inChannel(session.platform, session.channelId) && config.channelRecall) {
                ctx.setTimeout(async () => {
                  try {
                    await session.bot.deleteMessage(session.channelId, msgId)
                  } catch (error) {
                    logger.warn(error)
                  }
                }, config.recallTime)
              }
              return
            }
          }
        }
        return `访问站点失败，请联系管理员确认错误信息`
      } else {
        return '没有站点数据可供使用，请先使用 nezha add 添加站点数据'
      }
    })

  mainCmd.subcommand('.list [tag:string]', '获取所有服务器的状态信息摘要')
    .action(async ({ session }, tag) => {
      if (tag === undefined) {
        tag = ''
      }
      const { id } = await ctx.database.getUser(session.platform, session.userId, ['id'])
      const [ data ] = await ctx.database.get('nezha_site', { userId: id })
      if (data !== undefined) {
        const res = await ctx.http.get(buildUrl(data.url, listPath), { headers: buildHeader(data.token), params: { tag: tag === untagged ? '' : tag } })
          .catch((err) => { 
            return { error: err.message }
          })
          if (res !== undefined) {
            if ('error' in res) {
              return `访问站点失败，错误信息：${res.error}`
            }
            if ('code' in res && 'message' in res) {
              if (res.code !== 0) {
                return res.message
              }
              if ('result' in res) {
                if (res.result.length === 0) {
                  return '未检测到服务器'
                }

                let titlePrefix = ''
                if (tag !== '') {
                  if (tag === untagged) {
                    titlePrefix = '[默认]分组的'
                  } else {
                    titlePrefix = `[${tag}]分组的`
                  }
                }
                let details = [
                  `${titlePrefix}服务器状态信息摘要`,
                  '===========================',
                  '===========================',
                  'ID \t 状态 \t 分组 \t 服务器名',
                ]
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
                  dualNum += serverInfo.ipv4 !== '' && serverInfo.ipv6 !== '' ? 1 : 0
                  const status = alive ? '❇️在线' : '☠️离线'
                  details.push(`${serverInfo.id} \t ${status} \t ${serverInfo.tag === '' ? '🈳' : serverInfo.tag} \t ${serverInfo.name}`)
                }

                let startPos = 2
                details.splice(startPos++, 0, `服务器数量： ${serverNum}`)
                if (tag === '') {
                  details.splice(startPos++, 0, `分组的数量： ${Array.from(new Set(tagArr)).length}`)
                }
                details.splice(startPos++, 0, `离线服务器：${offlineNum}`)
                details.splice(startPos++, 0, `双栈服务器：${dualNum}`)

                const [ msgId ] = await session.sendQueued(details.join('\n'))
                if (await inChannel(session.platform, session.channelId) && config.channelRecall) {
                  ctx.setTimeout(async () => {
                    try {
                      await session.bot.deleteMessage(session.channelId, msgId)
                    } catch (error) {
                      logger.warn(error)
                    }
                  }, config.recallTime)
                }
                return
              }
            }
          }
          return `访问站点失败，请联系管理员确认错误信息`
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

  mainCmd.subcommand('.id <serverId:integer>', '通过id查询服务器详细信息')
    .action(async ({ session }, serverId) => {
      if (serverId === undefined) {
        session.sendQueued('请输入服务器id')
        serverId = Number(await session.prompt(config.responseTimeout))
        if (!Number.isSafeInteger(serverId)) {
          return '参数 id 输入无效，请提供一个整数。'
        }
      }
      const { id } = await ctx.database.getUser(session.platform, session.userId, ['id'])
      const [ data ] = await ctx.database.get('nezha_site', { userId: id })
      if (data !== undefined) {
        const res = await ctx.http.get(buildUrl(data.url, detailsPath), { headers: buildHeader(data.token), params: { id: serverId } })
          .catch((err) => { 
            return { error: err.message }
          })
        if (res !== undefined) {
          if ('error' in res) {
            return `访问站点失败，错误信息：${res.error}`
          }
          if ('code' in res && 'message' in res) {
            if (res.code !== 0) {
              return res.message
            }
            if ('result' in res) {
              if (res.result.length === 0) {
                return '未检测到服务器'
              }

              const serverInfo = res.result[0]
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
              let details = [
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
              const [ msgId ] = await session.sendQueued(details.join('\n'))
              if (await inChannel(session.platform, session.channelId) && config.channelRecall) {
                ctx.setTimeout(async () => {
                  try {
                    await session.bot.deleteMessage(session.channelId, msgId)
                  } catch (error) {
                    logger.warn(error)
                  }
                }, config.recallTime)
              }
              return
            }
          }
        }
        return `访问站点失败，请联系管理员确认错误信息`
      } else {
        return '没有站点数据可供使用，请先使用 nezha add 添加站点数据'
      }
    })

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
      const [ data ] = await ctx.database.get('nezha_site', { userId: id })
      if (data !== undefined) {
        const res = await ctx.http.get(buildUrl(data.url, listPath), { headers: buildHeader(data.token) })
          .catch((err) => { 
            return { error: err.message }
          })
          if (res !== undefined) {
            if ('error' in res) {
              return `访问站点失败，错误信息：${res.error}`
            }
            if ('code' in res && 'message' in res) {
              if (res.code !== 0) {
                return res.message
              }
              if ('result' in res) {
                if (res.result.length === 0) {
                  return '未检测到服务器'
                }

                let details = [
                  `服务器搜索结果`,
                  '===========================',
                  'ID \t 状态 \t 分组 \t 服务器名',
                ]
                res.result.sort((a, b) => { return a.id - b.id })
                let findCount = 0
                for (let i = 0; i < res.result.length; i++) {
                  const serverInfo = res.result[i]
                  if (serverInfo.name.indexOf(name) === -1) {
                    continue
                  }
                  findCount++
                  const alive = isServerAlive(serverInfo.last_active)
                  const status = alive ? '❇️在线' : '☠️离线'
                  details.push(`${serverInfo.id} \t ${status} \t ${serverInfo.tag === '' ? '🈳' : serverInfo.tag} \t ${serverInfo.name}`)
                }
                if (findCount === 0) {
                  return `没有找到名称包含\"${name}\"的服务器`
                }

                const [ msgId ] = await session.sendQueued(details.join('\n'))
                if (await inChannel(session.platform, session.channelId) && config.channelRecall) {
                  ctx.setTimeout(async () => {
                    try {
                      await session.bot.deleteMessage(session.channelId, msgId)
                    } catch (error) {
                      logger.warn(error)
                    }
                  }, config.recallTime)
                }
                return
              }
            }
          }
          return `访问站点失败，请联系管理员确认错误信息`
      } else {
        return '没有站点数据可供使用，请先使用 nezha add 添加站点数据'
      }
    })

  mainCmd.subcommand('.notify', '获取告警通知请求的部分参数')
    .action(async ({ session }) => {
      if (!config.alertNotify.enable) {
        return '告警通知未启用'
      }
      const message = [
        `URL：http(s)://YOUR_KOISHI_SITE/${config.alertNotify.path}`,
        '请求方式：POST',
        '请求类型：JSON',
        'Body:',
        '{',
        `  "platform": "${session.platform}",`,
        `  "userId": "${session.userId}",`,
        `  "groupId": "${session.guildId}",`,
        `  "content": "${config.alertNotify.bodyContent}"`,
        '}',
      ]
      if (!session.guildId) {
        message.splice(7, 1)
      }
      return message.join('\n')
    })
}
