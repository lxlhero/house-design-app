---
version: alpha
name: 装修管家 Premium
description: Apple HIG + Linear 精密美学 — 玻璃质感、精密字体、iPad 专属交互。
colors:
  # ── 品牌 ──
  blue: "#007AFF"
  blue-light: "#409CFF"
  blue-dark: "#0055CC"

  # ── 文字 ──
  label: "#000000"
  secondary-label: "#3C3C4399"
  tertiary-label: "#3C3C434D"
  placeholder: "#3C3C434D"

  # ── 背景 ──
  background: "#F2F2F7"
  surface: "#FFFFFF"
  grouped: "#F9F9F9"

  # ── 语义 ──
  red: "#FF3B30"
  green: "#34C759"
  orange: "#FF9500"

  # ── 分隔 ──
  separator: "#3C3C4333"
  border: "#E5E5EA"

  # ── 语义 Token（供组件引用） ──
  primary: "{colors.blue}"
  on-primary: "#FFFFFF"
  surface-fill: "{colors.surface}"
  on-surface: "{colors.label}"
  background-fill: "{colors.background}"
  muted: "{colors.secondary-label}"
  danger: "{colors.red}"
  success: "{colors.green}"
  warning: "{colors.orange}"

typography:
  large-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
    fontSize: 2.125rem
    fontWeight: 700
    lineHeight: 1.18
    letterSpacing: "0.012em"
  title-1:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
    fontSize: 1.75rem
    fontWeight: 700
    lineHeight: 1.21
  title-2:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
    fontSize: 1.375rem
    fontWeight: 600
    lineHeight: 1.27
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
    fontSize: 1.0625rem
    lineHeight: 1.47
    letterSpacing: "-0.022em"
  callout:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
    fontSize: 1rem
    fontWeight: 500
    lineHeight: 1.35
  subhead:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
    fontSize: 0.9375rem
    fontWeight: 600
    lineHeight: 1.33
  footnote:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
    fontSize: 0.8125rem
    lineHeight: 1.38
    letterSpacing: "0.004em"
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: "0.02em"

rounded:
  xs: 6px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  full: 9999px

spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 20px
  xl: 24px
  xxl: 32px

elevation:
  nav-bar:
    shadow: "0 0.5px 0 0 {colors.separator}"
    blur: 20px
  card:
    shadow: "0 1px 3px 0 rgba(0,0,0,0.04)"
  modal:
    shadow: "0 8px 40px 0 rgba(0,0,0,0.12)"

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    padding: 14px
  button-primary-hover:
    backgroundColor: "{colors.blue-dark}"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    padding: 14px
  nav-bar:
    backgroundColor: "rgba(242,242,247,0.72)"
    textColor: "{colors.label}"
    rounded: 0
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: 20px
  input:
    backgroundColor: "{colors.grouped}"
    textColor: "{colors.label}"
    rounded: "{rounded.sm}"
    padding: 14px
  badge:
    backgroundColor: "{colors.separator}"
    textColor: "{colors.secondary-label}"
    rounded: "{rounded.full}"
    padding: 6px
  badge-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    padding: 6px
---

## Overview

装修管家（Home Design Pro）服务于一位妈妈的别墅装修管理需求。设计遵循
Apple Human Interface Guidelines 的精神 —— **通透、克制、让内容主导**。

核心感受：打开 App 像翻开一本精心排版的杂志，信息层次分明，操作直觉自然。
没有装饰性元素，每一个像素都服务于功能。

## Colors

Apple 语义色体系。主色 `blue` (#007AFF) 是唯一的强调色，用于按钮、选中态和
链接。灰色系提供文字层次（label → secondary-label → tertiary-label），
背景色分三层（background / surface / grouped）建立深度。

- **Primary ({colors.primary}):** 交互驱动色。按钮、选中态、进度条。
- **On Primary ({colors.on-primary}):** 白色，确保主色之上文字可读。
- **Label ({colors.label}):** 纯黑色，核心文字、标题。
- **Secondary Label:** 辅助文字、描述、元数据（黑色 60% 透明度）。
- **Tertiary Label:** 占位符、禁用态文字（黑色 30% 透明度）。
- **Background ({colors.background-fill}):** iOS 系统灰，整页底色。
- **Surface ({colors.surface-fill}):** 白色，卡片和弹窗表面。
- **Separator:** 分隔线、轻量边框，不抢注意力。
- **Semantic colors:** red 仅用于删除/错误，green 用于成功/节省，
  orange 用于警告/超预算。

## Typography

唯一字体：系统 San Francisco（`-apple-system`），通过字重和大小建立层次。
中文与英文混排自然协调。

| Token | 用途 | 大小/字重 |
|-------|------|----------|
| large-title | 页面主标题（仪表盘） | 34px Bold |
| title-1 | 次级标题 | 28px Bold |
| title-2 | 段落标题 | 22px Semibold |
| body | 正文（表格内容、说明） | 17px Regular |
| callout | 强调正文（金额数字） | 16px Medium |
| subhead | 辅助标题 | 15px Semibold |
| footnote | 小字说明 | 13px Regular |
| caption | 标签、徽章文字 | 12px Medium |

## Layout

以 4px 为基准的间距体系：`md` (16px) 是组件内间距，`lg` (20px) 是组件间
间距。iPad 横向留白充足（`lg` → `xxl`），不做紧凑布局。

## Elevation & Depth

不使用重型阴影。通过背景色分层（background → surface）和极细边框（0.5px）
建立层级。导航栏使用 `backdrop-blur` 毛玻璃效果 —— 这是 iOS 的标志性手法。

## Shapes

全圆角按钮（pill shape），圆角卡片（12-20px）。不出现直角矩形。

## Components

- `button-primary`: 唯一的主要操作按钮。全圆角，蓝色填充，白色文字。
- `button-secondary`: 次要操作，白底蓝字，有轻量边框。
- `nav-bar`: 磨砂玻璃顶栏，透出底层内容。
- `card`: 白色圆角卡片，极淡阴影创造浮起感。
- `input`: 浅灰底，8px 圆角，用于搜索和表单。
- `badge`: 胶囊标签，默认灰色，活跃态变蓝。

## Do's and Don'ts

- **Do** 使用语义色（red/green/orange）传达状态，而非装饰。
- **Do** 用 backdrop-blur 做导航栏，这是 iOS 的灵魂。
- **Do** 留足白空间，iPad 大屏幕不要塞满。
- **Don't** 使用多重阴影或 heavy drop shadow。
- **Don't** 引入蓝色系之外的装饰色。
- **Don't** 混合多种字体家族。
