/* Copyright 2023 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {noContextMenu, stopEvent} from "../display_utils.js";
import MarkdownIt from 'https://cdn.jsdelivr.net/npm/markdown-it@14.1.0/+esm'

const md = new MarkdownIt();

class EditorToolbar {
  #toolbar = null;

  #colorPicker = null;

  #editor;

  #buttons = null;

  #altText = null;

  #signatureDescriptionButton = null;

  static #l10nRemove = null;

  constructor(editor) {
    this.#editor = editor;

    EditorToolbar.#l10nRemove ||= Object.freeze({
      freetext: "pdfjs-editor-remove-freetext-button",
      highlight: "pdfjs-editor-remove-highlight-button",
      ink: "pdfjs-editor-remove-ink-button",
      stamp: "pdfjs-editor-remove-stamp-button",
      signature: "pdfjs-editor-remove-signature-button",
    });
  }

  render() {
    const editToolbar = (this.#toolbar = document.createElement("div"));
    editToolbar.classList.add("editToolbar", "hidden");
    editToolbar.setAttribute("role", "toolbar");
    const signal = this.#editor._uiManager._signal;
    editToolbar.addEventListener("contextmenu", noContextMenu, { signal });
    editToolbar.addEventListener("pointerdown", EditorToolbar.#pointerDown, {
      signal,
    });

    const buttons = (this.#buttons = document.createElement("div"));
    buttons.className = "buttons";
    editToolbar.append(buttons);

    const position = this.#editor.toolbarPosition;
    if (position) {
      const { style } = editToolbar;
      const x =
        this.#editor._uiManager.direction === "ltr"
          ? 1 - position[0]
          : position[0];
      style.insetInlineEnd = `${100 * x}%`;
      style.top = `calc(${
        100 * position[1]
      }% + var(--editor-toolbar-vert-offset))`;
    }

    this.#addDeleteButton();

    return editToolbar;
  }

  get div() {
    return this.#toolbar;
  }

  static #pointerDown(e) {
    e.stopPropagation();
  }

  #focusIn(e) {
    this.#editor._focusEventsAllowed = false;
    stopEvent(e);
  }

  #focusOut(e) {
    this.#editor._focusEventsAllowed = true;
    stopEvent(e);
  }

  #addListenersToElement(element) {
    // If we're clicking on a button with the keyboard or with
    // the mouse, we don't want to trigger any focus events on
    // the editor.
    const signal = this.#editor._uiManager._signal;
    element.addEventListener("focusin", this.#focusIn.bind(this), {
      capture: true,
      signal,
    });
    element.addEventListener("focusout", this.#focusOut.bind(this), {
      capture: true,
      signal,
    });
    element.addEventListener("contextmenu", noContextMenu, { signal });
  }

  hide() {
    this.#toolbar.classList.add("hidden");
    this.#colorPicker?.hideDropdown();
  }

  show() {
    this.#toolbar.classList.remove("hidden");
    this.#altText?.shown();
  }

  #addDeleteButton() {
    const { editorType, _uiManager } = this.#editor;

    const button = document.createElement("button");
    button.className = "delete";
    button.tabIndex = 0;
    button.setAttribute("data-l10n-id", EditorToolbar.#l10nRemove[editorType]);
    this.#addListenersToElement(button);
    button.addEventListener(
      "click",
      e => {
        _uiManager.delete();
      },
      { signal: _uiManager._signal }
    );
    this.#buttons.append(button);
  }

  get #divider() {
    const divider = document.createElement("div");
    divider.className = "divider";
    return divider;
  }

  async addAltText(altText) {
    const button = await altText.render();
    this.#addListenersToElement(button);
    this.#buttons.prepend(button, this.#divider);
    this.#altText = altText;
  }

  addColorPicker(colorPicker) {
    this.#colorPicker = colorPicker;
    const button = colorPicker.renderButton();
    this.#addListenersToElement(button);
    this.#buttons.prepend(button, this.#divider);
  }

  async addEditSignatureButton(signatureManager) {
    const button = (this.#signatureDescriptionButton =
      await signatureManager.renderEditButton(this.#editor));
    this.#addListenersToElement(button);
    this.#buttons.prepend(button, this.#divider);
  }

  updateEditSignatureButton(description) {
    if (this.#signatureDescriptionButton) {
      this.#signatureDescriptionButton.title = description;
    }
  }

  remove() {
    this.#toolbar.remove();
    this.#colorPicker?.destroy();
    this.#colorPicker = null;
  }
}

class AiHelp{
  #uiManager;
  #buttons
  #selectedTextDom
  #aiTextDom
  #closeBtn
  #sideBarTitleDom
  #sideBarDom
  loading=false
  #abortController
  #aiContent
  #btn
  #editToolbar
  constructor(uiManager,buttons,editToolbar) {
    this.#uiManager = uiManager;
    this.#buttons = buttons;
    this.#editToolbar = editToolbar
    this.#sideBarDom = this.#renderPdfSideBar()

    this.#selectedTextDom = this.#sideBarDom.querySelector('.selectedText')
    this.#aiTextDom = this.#sideBarDom.querySelector('.aiText')
    this.#sideBarTitleDom = this.#sideBarDom.querySelector('.sideBarTitle')
    this.#closeBtn = this.#sideBarDom.querySelector('.closeBtn')

    this.#closeBtn.addEventListener('click', this.#close.bind(this))
  }
  #updateAiText(world) {
    this.#aiContent += world
    this.#aiTextDom.innerHTML = md.render(this.#aiContent);
  }
  #updateSelectedText(text){
    this.#selectedTextDom.textContent = text;
  }
  async #getPdfOutline() {
    const outline = await window.PDFViewerApplication.pdfDocument.getOutline();

    // function buildOutlineTree(outlineItems) {
    //   if (!outlineItems) return [];
    //   return outlineItems.map(item => ({
    //     title: item.title,
    //     items: buildOutlineTree(item.items) // 递归处理子目录
    //   }));
    // }

    // return buildOutlineTree(outline);
    if (!outline) return [];
    return outline.map(item=> item.title)
  }
  #open(selectionText){
    this.#selectedTextDom.textContent = ''
    this.#aiTextDom.innerHTML = ''
    this.#aiContent = ''
    this.#editToolbar.remove()
    this.#sideBarDom.style.transform = 'translateX(0)'
    if(selectionText){
      this.#abortController = new AbortController()
      this.#aiContent = ''
      this.askAi(selectionText,this.#abortController)
    }
  }
  #close(){
    this.#sideBarDom.style.transform = 'translateX(100%)'
    if(this.#abortController){
      this.#abortController.abort()
    }
  }
  #showLoading(){
   this.loading = true
   this.#sideBarTitleDom.textContent = this.#sideBarTitleDom.textContent + '(正在回答)'
  }
  #hideLoading(){
    this.loading = false
    this.#sideBarTitleDom.textContent = '解释内容'
  }
  async askAi(text){
    if(this.loading) return
    try{
      const outline = await this.#getPdfOutline()
      const prompt = `
      ${text}
      1. 以上是一本书的一部分文字，你需要站在一个新手的角度上，学习以上文字，你可以尽可能联想，猜测可能存在的问题与疑问，然后给出答案
      2. 知识不是独立存在的，以下是这本书的目录，你可以尽可能的联想，找出给出文字与其他知识的联系
      ${JSON.stringify(outline)}
      `
      if(this.#abortController?.aborted) return Promise.reject({type:'aborted'});
      this.#showLoading()
      this.#updateSelectedText(text)
      const baseUrl = 'https://qianfan.baidubce.com/v2'
      const respStream = await fetch('https://ai-proxy-xulbdqvsbn.cn-hongkong.fcapp.run/chat/completions', {
        method: 'POST',
        headers: {
          'x-base-url': baseUrl,
          'x-api-key': 'YmNlLXYzL0FMVEFLLXAzRE02TldkVERKSXpKRDVYM1VvMC85ZjA5NmQ4YWE4MzZhZDU0MzA0ZGNkMGUxMGQ4ODk1ZGJhNzEzNDky',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "deepseek-v3",
          messages: [{
            role: "user",
            content: prompt
          }],
          stream: true
        }),
        signal: this.#abortController.signal,
      })

      if(this.#abortController?.aborted) return Promise.reject({type:'aborted'});

      const reader = respStream.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const {done, value} = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        if(chunk.startsWith('data: ')){
          const lines = chunk.split('data:').filter(line => !!line).map(line=> {
            if(/\s*\[DONE\]\n*/.test(line)) return '[DONE]';
            return JSON.parse(line.trim())
          })
          lines.forEach(line => {
            if(line !== '[DONE]'){
              const {reasoning_content, content} = line.choices[0].delta
              if(reasoning_content){
                console.log(reasoning_content);
              }
              if(content){
                console.log(content);
                this.#updateAiText(content);
              }
            }
            else {
              console.log('done');
            }
          })
        }
        else{
          console.log('error', chunk);
          this.#updateAiText(chunk);
        }
      }
    } catch (e){

    } finally {
      this.#hideLoading();
    }

  }
  #onBtnClick(e){
    const selection = document.getSelection();
    if (!selection || selection.isCollapsed) {
      return;
    }
    const selectionText = selection.toString();
    this.#open(selectionText)
  }
  #removeButton(){
    this.#buttons.removeChild(this.#btn)
  }
  addButton(){
    if(this.#btn) return
    const button = document.createElement("button");
    this.#btn = button
    button.textContent = "help";
    button.title = "我是新手";
    button.tabIndex = 1;
    button.style.padding = '0 5px'
    const span = document.createElement("span");
    button.append(span);
    const signal = this.#uiManager._signal;
    button.addEventListener("contextmenu", noContextMenu, { signal });
    button.addEventListener(
      "click",
      this.#onBtnClick.bind(this),
      { signal }
    );
    this.#buttons.append(button);
  }
  #renderPdfSideBar(){
    const container = document.createElement('div')
    container.style.cssText = `width: 384px; background-color: white; border-left: 1px solid rgb(229, 231, 235); position: fixed; top: 32px; bottom: 50px ;right: 0px; transform: translateX(100%) ;transition: transform 0.3s ease-in-out; display: flex; flex-direction: column;`
    container.innerHTML = `
      <div style="padding: 16px; border-bottom: 1px solid rgb(229, 231, 235); display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0px; font-weight: 500;" class="sideBarTitle">解释内容</h3>
        <button class="closeBtn" style="background: none; border: none; cursor: pointer; padding: 4px;">✕</button>
      </div>
      <div style="flex: 1 1 0%; overflow: auto; padding: 16px;">
        <div style="margin-top: 0px;">
            <div style="padding: 12px; background-color: rgb(249, 250, 251); border-radius: 8px; margin-bottom: 16px;">
                <p style="margin: 0px 0px 4px; font-size: 14px; color: rgb(107, 114, 128);">
                    选中文字：
                </p>
                <p class="selectedText" style="margin: 0px; font-weight: 500;">

                </p>
            </div>
            <div class="aiText" style="white-space: pre-wrap; line-height: 1.6;">

            </div>
        </div>
      </div>
    `
    document.body.appendChild(container);
    return container
  }
}

class HighlightToolbar {
  #buttons = null;

  #toolbar = null;

  #uiManager;
  #aiHelp

  constructor(uiManager) {
    this.#uiManager = uiManager;
  }

  #render() {
    const editToolbar = (this.#toolbar = document.createElement("div"));
    editToolbar.className = "editToolbar";
    editToolbar.setAttribute("role", "toolbar");
    editToolbar.addEventListener("contextmenu", noContextMenu, {
      signal: this.#uiManager._signal,
    });

    const buttons = (this.#buttons = document.createElement("div"));
    buttons.className = "buttons";
    editToolbar.append(buttons);

    this.#addHighlightButton();
    if(!this.#aiHelp){
      this.#aiHelp = new AiHelp(this.#uiManager, this.#buttons,editToolbar);
    }
    this.#aiHelp.addButton()

    return editToolbar;
  }

  #getLastPoint(boxes, isLTR) {
    let lastY = 0;
    let lastX = 0;
    for (const box of boxes) {
      const y = box.y + box.height;
      if (y < lastY) {
        continue;
      }
      const x = box.x + (isLTR ? box.width : 0);
      if (y > lastY) {
        lastX = x;
        lastY = y;
        continue;
      }
      if (isLTR) {
        if (x > lastX) {
          lastX = x;
        }
      } else if (x < lastX) {
        lastX = x;
      }
    }
    return [isLTR ? 1 - lastX : lastX, lastY];
  }

  show(parent, boxes, isLTR) {
    const [x, y] = this.#getLastPoint(boxes, isLTR);
    const { style } = (this.#toolbar ||= this.#render());
    parent.append(this.#toolbar);
    style.insetInlineEnd = `${100 * x}%`;
    style.top = `calc(${100 * y}% + var(--editor-toolbar-vert-offset))`;
  }

  hide() {
    this.#toolbar.remove();
  }

  #addHighlightButton() {
    const button = document.createElement("button");
    button.className = "highlightButton";
    button.tabIndex = 0;
    button.setAttribute("data-l10n-id", `pdfjs-highlight-floating-button1`);
    const span = document.createElement("span");
    button.append(span);
    span.className = "visuallyHidden";
    span.setAttribute("data-l10n-id", "pdfjs-highlight-floating-button-label");
    const signal = this.#uiManager._signal;
    button.addEventListener("contextmenu", noContextMenu, { signal });
    button.addEventListener(
      "click",
      () => {
        this.#uiManager.highlightSelection("floating_button");
      },
      { signal }
    );
    this.#buttons.append(button);
  }
}

export { EditorToolbar, HighlightToolbar };
