# koishi-plugin-nezha-api

[![npm](https://img.shields.io/npm/v/koishi-plugin-nezha-api?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-nezha-api)

适用于 [koishi](https://koishi.chat/) 的 [nezha](https://nezha.wiki/index.html) 插件

## 使用说明

### 指令：nezha
* 基本语法：`nezha`
* 指令功能：输出插件的简易信息

### 指令：nezha help
* 基本语法：`nezha help`
* 指令功能：等价于 `help nezha`

### 指令：nezha add
* 基本语法：`nezha add [url:string] [token:string]`
* 指令功能：添加哪吒站点的url和token至数据库，请确保url和token均有效
* 使用限制：**仅私聊可用**，支持交互式输入

### 指令：nezha url
* 基本语法：`nezha url [url:string]`
* 指令功能：修改数据库中记录的站点url，请确保已使用 `nezha add` 添加过数据
* 使用限制：**仅私聊可用**，支持交互式输入

### 指令：nezha token
* 基本语法：`nezha url [token:string]`
* 指令功能：修改数据库中记录的站点token，请确保已使用 `nezha add` 添加过数据
* 使用限制：**仅私聊可用**，支持交互式输入

### 指令：nezha info
* 基本语法：`nezha info`
* 指令功能：查看数据库中记录的站点url和token
* 使用限制：**仅私聊可用**

### 指令：nezha all
* 基本语法：`nezha all [tag:string]`
* 指令功能：获取 `tag` 分组下所有服务器的统计数据摘要，留空则返回所有数据，当且仅当 `tag` 为 `untagged` 时返回未分组的数据

### 指令：nezha list
* 基本语法：`nezha list [tag:string]`
* 指令功能：获取 `tag` 分组下所有服务器的状态信息摘要，留空则返回所有数据，当且仅当 `tag` 为 `untagged` 时返回未分组的数据

### 指令：nezha id
* 基本语法：`nezha id [id:number]`
* 指令功能：获取ID为 `id` 的服务器详细信息

### 指令：nezha search
* 基本语法：`nezha search [name:string]`
* 指令功能：搜索名称包含关键字 `name` 的服务器状态信息摘要

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
* 默认值：`false`

是否开启群聊自动撤回

### recallTime
* 类型：`number`
* 默认值：`15000`

群聊自动撤回的延迟时间（单位为毫秒）

### aliveThreshold
* 类型：`number`
* 默认值：`300`

判断服务器是否在线的时间间隔（单位为秒）

## 致谢

* 本项目基于 [naiba/nezha](https://github.com/naiba/nezha) 提供的API进行开发，在此感谢nezha项目组的全体成员
* 本项目基于 [koishijs/koishi](https://github.com/koishijs/koishi) 框架进行插件开发，在此感谢koishi项目组的全体成员
* 本项目受启发于 [tech-fever/nezha_telegram_bot](https://github.com/tech-fever/nezha_telegram_bot) ，在此感谢作者[tech-fever](https://github.com/tech-fever)
