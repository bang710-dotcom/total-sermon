#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_hwpx.py — 설교 산출물(원고·카드원고·LTC 교재·설교계획)을 hwpx로 만든다.

원리
  목사님 실제 원고에서 본문만 비운 "껍데기 hwpx"(templates/*.hwpx)를 그대로 쓴다.
  용지·여백·글꼴·색·문단 간격·표 테두리는 모두 껍데기의 header.xml 안에
  charPr/paraPr/borderFill 로 이미 확정돼 있고, 이 스크립트는 역할(role)에
  맞는 ID로 본문 문단만 찍어 넣는다. → 서식이 원본과 100% 동일하다.

사용법
  python3 build_hwpx.py content.json 출력.hwpx

content.json
  {
    "type": "manuscript" | "card" | "ltc" | "plan",
    "slots": ["제목줄", ...],            # 첫 문단(제목·머리띠)에 채울 문자열
    "blocks": [
      {"role": "body", "text": "..."},
      {"role": "point", "runs": [["num","1. "], ["pname","제목"], ["pref"," (24:6)"]]},
      {"role": "bar", "text": "▶  이미지 #3  전환  ◀"},        # 카드원고 전용
      {"role": "table", "rows": [[ "회차", "주일예배", ... ], ...]}  # 설교계획 전용
    ]
  }
"""
import sys, os, json, re, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, 'hwpx_types.json'), encoding='utf-8') as f:
    TYPES = json.load(f)


def tbl_id():
    import random
    return random.randint(1000000000, 2000000000)


def esc(s):
    s = '' if s is None else str(s)
    s = s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    return re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', s)


def run_xml(char_id, text):
    return '<hp:run charPrIDRef="%s"><hp:t>%s</hp:t></hp:run>' % (char_id, esc(text))


def para_xml(para_id, inner):
    return ('<hp:p id="0" paraPrIDRef="%s" styleIDRef="0" pageBreak="0" '
            'columnBreak="0" merged="0">%s</hp:p>' % (para_id, inner))


def build_blocks(spec, blocks):
    styles, roles = spec['styles'], spec['roles']
    out = []
    for b in blocks:
        role = b.get('role', 'body')

        if role == 'bar':                       # 카드원고 — 이미지 전환 빨간 띠(1×1 표)
            bar = spec['bar']
            cell_p = para_xml(bar['para'], run_xml(styles[bar['style']], b.get('text', ''))
                              + ('<hp:run charPrIDRef="%d"/>' % bar['tailRun'] if 'tailRun' in bar else ''))
            tc = ('<hp:tc name="" header="0" hasMargin="%s" protect="0" editable="0" dirty="0" '
                  'borderFillIDRef="%d"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" '
                  'vertAlign="%s" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" '
                  'hasTextRef="0" hasNumRef="0">%s</hp:subList><hp:cellAddr colAddr="0" rowAddr="0"/>'
                  '<hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="%d" height="%d"/>'
                  '<hp:cellMargin %s/></hp:tc>'
                  % (bar['hasMargin'], bar['cellFill'], bar['vertAlign'], cell_p,
                     bar['width'], bar['cellHeight'], bar['cellMargin']))
            tbl = ('<hp:tbl id="%d" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" '
                   'textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="%s" '
                   'rowCnt="1" colCnt="1" cellSpacing="0" borderFillIDRef="%d" noAdjust="0">'
                   '<hp:sz width="%d" widthRelTo="ABSOLUTE" height="%d" heightRelTo="ABSOLUTE" protect="0"/>'
                   '<hp:pos treatAsChar="%s" affectLSpacing="0" flowWithText="1" allowOverlap="0" '
                   'holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" '
                   'vertOffset="0" horzOffset="0"/><hp:outMargin %s/>'
                   '<hp:inMargin %s/><hp:tr>%s</hp:tr></hp:tbl>'
                   % (tbl_id(), bar['repeatHeader'], bar['tblFill'], bar['width'], bar['height'],
                      bar['treatAsChar'], bar['outMargin'], bar['inMargin'], tc))
            out.append(para_xml(spec['roles']['line']['para'],
                                '<hp:run charPrIDRef="%d">%s</hp:run>' % (styles['normal'], tbl)))
            continue

        if role == 'table':                     # 설교계획 — 6열 표
            out.append(table_xml(spec, b))
            continue

        r = roles.get(role) or roles.get('body') or list(roles.values())[0]
        runs = b.get('runs')
        if runs:
            inner = ''.join(run_xml(styles.get(s, styles[r['style']]), t) for s, t in runs)
        elif b.get('text'):
            inner = run_xml(styles[r['style']], b['text'])
        else:
            inner = '<hp:run charPrIDRef="%d"/>' % styles[r['style']]
        out.append(para_xml(r['para'], inner))
    return ''.join(out)


def table_xml(spec, blk):
    T = spec['table']
    styles = spec['styles']
    rows = blk.get('rows') or []
    cols = T['cols']
    body = ''
    for ri, row in enumerate(rows):
        cells = ''
        fills = T['headFill'] if ri == 0 else (T['firstFill'] if ri == 1 else T['rowFill'])
        st = styles[T['headStyle'] if ri == 0 else T['dataStyle']]
        h = T['headHeight'] if ri == 0 else T['rowHeight']
        for ci in range(len(cols)):
            cell = row[ci] if ci < len(row) else ''
            lines = cell if isinstance(cell, list) else [cell]
            ps = ''.join(para_xml(T['cellPara'],
                                  run_xml(st, t) if str(t or '') else '<hp:run charPrIDRef="%d"/>' % st)
                         for t in lines)
            cells += ('<hp:tc name="" header="0" hasMargin="%s" protect="0" editable="0" dirty="0" '
                      'borderFillIDRef="%d"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" '
                      'vertAlign="%s" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" '
                      'textHeight="0" hasTextRef="0" hasNumRef="0">%s</hp:subList>'
                      '<hp:cellAddr colAddr="%d" rowAddr="%d"/><hp:cellSpan colSpan="1" rowSpan="1"/>'
                      '<hp:cellSz width="%d" height="%d"/>'
                      '<hp:cellMargin %s/></hp:tc>'
                      % (T['hasMargin'], fills[ci], T['vertAlign'], ps, ci, ri, cols[ci], h, T['cellMargin']))
        body += '<hp:tr>%s</hp:tr>' % cells
    total_w = sum(cols)
    total_h = T['headHeight'] + T['rowHeight'] * max(0, len(rows) - 1)
    tbl = ('<hp:tbl id="%d" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" '
           'lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="%s" rowCnt="%d" colCnt="%d" '
           'cellSpacing="0" borderFillIDRef="%d" noAdjust="0">'
           '<hp:sz width="%d" widthRelTo="ABSOLUTE" height="%d" heightRelTo="ABSOLUTE" protect="0"/>'
           '<hp:pos treatAsChar="%s" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" '
           'vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>'
           '<hp:outMargin %s/><hp:inMargin %s/>%s</hp:tbl>'
           % (tbl_id(), T['repeatHeader'], len(rows), len(cols), T['tblFill'], total_w, total_h,
              T['treatAsChar'], T['outMargin'], T['inMargin'], body))
    return para_xml(T['cellPara'], '<hp:run charPrIDRef="%d">%s</hp:run>' % (styles[T['dataStyle']], tbl))


def fill_slots(sec, texts):
    """첫 문단(제목·머리띠)의 빈 <hp:t></hp:t> 자리를 순서대로 채운다. None = 건너뜀(꼬리말 등)."""
    head_end = sec.find('</hp:secPr>')
    pat = '<hp:t></hp:t>'
    out, pos, i = sec[:head_end], head_end, 0
    rest = sec[head_end:]
    while i < len(texts):
        k = rest.find(pat)
        if k < 0:
            break
        t = texts[i]
        out += rest[:k] + ('<hp:t>%s</hp:t>' % esc(t) if t is not None else pat)
        rest = rest[k + len(pat):]
        i += 1
    return out + rest


def build(content, out_path, base_dir=HERE):
    tkey = content.get('type')
    if tkey not in TYPES:
        raise SystemExit('type 은 %s 중 하나여야 합니다: %r' % (list(TYPES.keys() - {'_설명'}), tkey))
    spec = TYPES[tkey]
    tpl = os.path.join(base_dir, spec['shell'])
    z = zipfile.ZipFile(tpl)
    sec = z.read('Contents/section0.xml').decode('utf-8')
    sec = fill_slots(sec, content.get('slots') or [])
    sec = sec.replace('</hs:sec>', build_blocks(spec, content.get('blocks') or []) + '</hs:sec>')

    if os.path.exists(out_path):
        os.remove(out_path)
    zo = zipfile.ZipFile(out_path, 'w')
    zo.writestr(zipfile.ZipInfo('mimetype'), z.read('mimetype'), compress_type=zipfile.ZIP_STORED)
    for n in z.namelist():
        if n == 'mimetype':
            continue
        data = sec.encode('utf-8') if n == 'Contents/section0.xml' else z.read(n)
        zo.writestr(n, data, compress_type=zipfile.ZIP_DEFLATED)
    zo.close()

    # 무결성 확인 — zip + XML 파싱
    import xml.dom.minidom as md
    zz = zipfile.ZipFile(out_path)
    assert zz.testzip() is None, 'ZIP 손상'
    md.parseString(zz.read('Contents/section0.xml'))
    md.parseString(zz.read('Contents/header.xml'))
    return out_path


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    with open(sys.argv[1], encoding='utf-8') as f:
        content = json.load(f)
    build(content, sys.argv[2])
    print('생성 완료:', sys.argv[2])


if __name__ == '__main__':
    main()
