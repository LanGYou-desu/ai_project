"""命令解析工具：安全分词。零依赖。

场景里的命令来自玩家输入，引号不配对（例如 log search ' OR）很常见，
shlex 会直接抛 ValueError；这里退化成一个保留剩余文本的宽松分词器。
"""

import shlex


def tokenize(cmd):
    """把命令行字符串切成 token（支持引号和重定向符号）。

    正常情况使用 shlex.split；引号不配对时退化为宽松分词，
    并把未闭合引号后的内容合并成一个 token（例如 ' OR）。
    """
    if not cmd or not cmd.strip():
        return []
    try:
        return shlex.split(cmd)
    except ValueError:
        out, buf, quote = [], [], None
        for part in cmd.split():
            if quote is None:
                # 单个引号也算未闭合；只有 len>1 且首尾都是引号才算成对。
                if part.startswith("'") and not (len(part) > 1 and part.endswith("'")):
                    quote, buf = "'", [part]
                elif part.startswith('"') and not (len(part) > 1 and part.endswith('"')):
                    quote, buf = '"', [part]
                else:
                    out.append(part)
            else:
                buf.append(part)
                if part.endswith(quote):
                    quote = None
                    out.append(" ".join(buf))
                    buf = []
        if buf:
            out.append(" ".join(buf))
        return out
