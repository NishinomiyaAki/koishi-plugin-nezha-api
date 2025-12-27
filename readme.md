# koishi-plugin-nezha-api

[![npm](https://img.shields.io/npm/v/koishi-plugin-nezha-api?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-nezha-api)

适用于 [koishi](https://koishi.chat/) 的 [nezha](https://nezha.wiki/) 和 [komari](https://komari-document.pages.dev/) 插件

## 使用说明

### 指令：nezha
* 基本语法：`nezha`
* 指令功能：输出插件的简易信息

### 指令：nezha help
* 基本语法：`nezha help`
* 指令功能：等价于 `help nezha`

### 指令：nezha add
* 基本语法：`nezha add <type:string> [url:string] [input1:string] [input2:string]`
* 指令功能：添加 `NezhaV0` / `NezhaV1` / `Komari` 站点的 `url` 和 `token` / `username` & `password` 至数据库，请确保 `url` 和 `token` / `username` & `password` 均有效
* 使用限制：**仅私聊可用**，支持交互式输入

### 指令：nezha delete/del
* 基本语法：`nezha del <type:string>`
* 指令功能：删除已保存的站点数据
* 使用限制：**仅私聊可用**，支持交互式输入

### 指令：nezha url
* 基本语法：`nezha url <type:string> [url:string]`
* 指令功能：修改数据库中记录的指定类型的站点 `url` ，请确保已使用 `nezha add` 添加过数据
* 使用限制：**仅私聊可用**，支持交互式输入

### 指令：nezha token
* 基本语法：`nezha url [token:string]`
* 指令功能：修改数据库中记录 `NezhaV0` 的站点 `token` ，请确保已使用 `nezha add` 添加过数据
* 使用限制：**仅私聊可用**，支持交互式输入

### 指令：nezha info
* 基本语法：`nezha info`
* 指令功能：查看数据库中记录的所有站点 `url` 和 `token` / `username` & `password`
* 使用限制：**仅私聊可用**

### 指令：nezha all
* 基本语法：`nezha all [type:string] [tag:string]`
* 指令功能：获取 `tag` 分组下所有服务器的统计数据摘要，留空则返回所有数据，当且仅当 `tag` 为 `untagged` 时返回未分组的数据
* 使用限制：`tag` 参数仅支持 `NezhaV0` 站点

### 指令：nezha list
* 基本语法：`nezha list [type:string] [tag:string]`
* 指令功能：获取 `tag` 分组下所有服务器的状态信息摘要，留空则返回所有数据，当且仅当 `tag` 为 `untagged` 时返回未分组的数据
* 使用限制：`tag` 参数仅支持 `NezhaV0` 站点

### 指令：nezha id
* 基本语法：`nezha id <type:string> [id:number]`
* 指令功能：获取ID为 `id` 的服务器详细信息
* 使用限制：仅支持 `NezhaV0` 和 `NezhaV1` 站点

### 指令：nezha uuid
* 基本语法：`nezha uuid <uuid:string>`
* 指令功能：获取UUID为 `uuid` 的服务器详细信息
* 使用限制：仅支持 `Komari` 站点

### 指令：nezha search
* 基本语法：`nezha search <name:string>`
* 指令功能：搜索所有站点中名称包含关键字 `name` 的服务器状态信息摘要

### 指令：nezha notify
* 基本语法：`nezha notify <type:string>`
* 指令功能：**需要公网部署**，获取不同站点的告警通知请求的部分参数，便于新增通知方式

## 配置项

### responseTimeout
* 类型：`number`
* 默认值：`15000`

交互式输入时，等待消息回复的时间（单位为毫秒）

### showChangedData
* 类型：`boolean`
* 默认值：`true`

站点数据发生改动时，返回的消息中是否包含数据改动

### channelRecall
* 类型：`boolean`
* 默认值：`true`

是否开启群聊自动撤回

### recallTime
* 类型：`number`
* 默认值：`15000`

群聊自动撤回的延迟时间（单位为毫秒）

### aliveThreshold
* 类型：`number`
* 默认值：`300`

判断服务器是否在线的时间间隔（单位为秒）

### alertNotify.enable
* 类型：`boolean`
* 默认值：`true`

是否开启告警通知监听

### alertNotify.path
* 类型：`string`
* 默认值：`/nezha/notify`

告警通知监听路径

### alertNotify.bodyContent.Nezha
* 类型：`string`
* 默认值：`# 探针通知\\n\\n时间：#DATETIME#\\n\\n#NEZHA#`

Nezha面板使用的告警通知内容模板

### alertNotify.bodyContent.Komari
* 类型：`string`
* 默认值：`# 探针通知\\n\\n时间：#DATETIME#\\n\\n#NEZHA#`

Komari面板使用的告警通知内容模板

## 致谢

* 本项目基于 [naiba/nezha](https://github.com/naiba/nezha) 提供的API进行开发，在此感谢nezha项目组的全体成员
* 本项目基于 [koishijs/koishi](https://github.com/koishijs/koishi) 框架进行插件开发，在此感谢koishi项目组的全体成员
* 本项目受启发于 [tech-fever/nezha_telegram_bot](https://github.com/tech-fever/nezha_telegram_bot) ，在此感谢作者[tech-fever](https://github.com/tech-fever)
