// 应用注册表：Dock / 启动器 / 深链 / 窗口标题都读这里
import type { Component } from 'svelte'
import type { AppCaps, Sys } from '../kernel/kernel.ts'
import About from './About.svelte'
import Projects from './Projects.svelte'
import Contact from './Contact.svelte'
import Files from './Files.svelte'
import Terminal from './Terminal.svelte'
import Music from './Music.svelte'
import Settings from './Settings.svelte'
import TaskMgr from './TaskMgr.svelte'
import Notepad from './Notepad.svelte'

/** 应用组件的统一 props 面：能力门面 + 启动参数 + 窗口 id */
export interface AppProps {
  sys: Sys | null
  arg?: string
  winId: number
}

export interface AppDef {
  id: string
  title: string
  /** 图标 id（对应 ui/app-icons.ts） */
  icon: string
  size: { w: number; h: number }
  /** 单实例应用（重复打开就聚焦旧窗口） */
  single: boolean
  caps: AppCaps
  component: Component<AppProps>
}

export const APPS: AppDef[] = [
  {
    id: 'about',
    title: '关于我',
    icon: 'about',
    size: { w: 620, h: 560 },
    single: true,
    caps: { fs: 'ro' },
    component: About,
  },
  {
    id: 'projects',
    title: '项目',
    icon: 'projects',
    size: { w: 760, h: 560 },
    single: true,
    caps: { fs: 'ro' },
    component: Projects,
  },
  {
    id: 'contact',
    title: '联系',
    icon: 'contact',
    size: { w: 560, h: 520 },
    single: true,
    caps: { fs: 'ro', notify: true },
    component: Contact,
  },
  {
    id: 'files',
    title: '文件',
    icon: 'files',
    size: { w: 820, h: 560 },
    single: true,
    caps: { fs: 'rw', notify: true },
    component: Files,
  },
  {
    id: 'terminal',
    title: '终端',
    icon: 'terminal',
    size: { w: 720, h: 460 },
    single: false,
    caps: { fs: 'sys', allowSudo: true, notify: true },
    component: Terminal,
  },
  {
    id: 'music',
    title: '音乐',
    icon: 'music',
    size: { w: 640, h: 520 },
    single: true,
    caps: { fs: 'rw', audio: true, notify: true },
    component: Music,
  },
  {
    id: 'settings',
    title: '系统设置',
    icon: 'settings',
    size: { w: 720, h: 560 },
    single: true,
    caps: { fs: 'sys', allowSudo: true, notify: true },
    component: Settings,
  },
  {
    id: 'taskmgr',
    title: '任务管理器',
    icon: 'taskmgr',
    size: { w: 720, h: 480 },
    single: true,
    caps: { fs: 'none' },
    component: TaskMgr,
  },
  {
    id: 'notepad',
    title: '记事本',
    icon: 'notepad',
    size: { w: 640, h: 520 },
    single: false,
    caps: { fs: 'rw', allowSudo: true, notify: true },
    component: Notepad,
  },
]

export const APP_MAP: Record<string, AppDef> = Object.fromEntries(APPS.map((a) => [a.id, a]))

/** Dock 上常驻的应用（其余应用运行时也会出现在 Dock） */
export const DOCK_PINNED = ['about', 'projects', 'contact', 'files', 'terminal', 'music', 'settings', 'taskmgr']
