/**
 * Cloze Tools for EFDRCE
 * Provides cloze manipulation features: removal and numbering
 */
(function () {
  const EFDRCE = window.EFDRCE

  // Regex to match cloze deletions: {{c1::content}} or {{c1::content::hint}}
  const CLOZE_REGEX = /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/g

  // ============ UNDO STACK ============

  const undoStack = []
  const MAX_UNDO = 50

  function saveUndoState(elem) {
    // Don't push duplicate states
    if (undoStack.length > 0) {
      const top = undoStack[undoStack.length - 1]
      if (top.elem === elem && top.html === elem.innerHTML) return
    }
    const sel = window.getSelection()
    let cursorOffset = -1
    if (sel && sel.rangeCount > 0) {
      try {
        const pre = document.createRange()
        pre.selectNodeContents(elem)
        pre.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset)
        cursorOffset = pre.toString().length
      } catch (e) { /* ignore */ }
    }
    undoStack.push({ elem, html: elem.innerHTML, cursorOffset })
    if (undoStack.length > MAX_UNDO) undoStack.shift()
  }

  EFDRCE.saveUndoState = saveUndoState;

  function undoClozeEdit(event, elem) {
    if (undoStack.length === 0) return
    const state = undoStack.pop()
    state.elem.innerHTML = state.html
    if (state.cursorOffset >= 0) {
      placeCursorAtOffset(state.elem, state.cursorOffset)
    }
  }

  // Intercept Cmd/Ctrl+Z only when our undo stack has entries
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && !e.altKey) {
      if (undoStack.length > 0) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        const state = undoStack.pop()
        state.elem.innerHTML = state.html
        if (state.cursorOffset >= 0) {
          placeCursorAtOffset(state.elem, state.cursorOffset)
        }
      }
    }
  }, true)

  /**
   * Get the cursor position within an element's text content
   * Returns the character offset from the start of the element's text
   */
  function getCursorTextOffset(elem) {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      return -1
    }
    const range = selection.getRangeAt(0)

    // Create a range from start of element to cursor
    const preCaretRange = document.createRange()
    preCaretRange.selectNodeContents(elem)
    preCaretRange.setEnd(range.startContainer, range.startOffset)

    // Get the text content length up to cursor
    return preCaretRange.toString().length
  }

  /**
   * Find the cloze at the current cursor position
   * Works by mapping HTML cloze positions to text positions
   * @param {HTMLElement} elem - The editable field element
   * @returns {Object|null} - {match, index, number, content, hint, start, end} or null
   */
  function getClozeAtCursor(elem) {
    const cursorPos = getCursorTextOffset(elem)
    if (cursorPos < 0) return null

    const html = elem.innerHTML

    // Find all clozes and their positions in both HTML and text
    let match
    const regex = new RegExp(CLOZE_REGEX.source, 'g')

    while ((match = regex.exec(html)) !== null) {
      const htmlStart = match.index
      const htmlEnd = htmlStart + match[0].length
      

      // Convert HTML position to text position
      // Create a temp element to get text from HTML before this match
      const htmlBefore = html.substring(0, htmlStart)
      const temp = document.createElement('div')
      temp.innerHTML = htmlBefore
      const textStart = temp.textContent.length
      const contentTextStart = textStart + match[1].length + 5

      // Get the text length of the FULL cloze markup (not just content)
      // This handles cases where cloze content might have HTML tags
      const clozeTemp = document.createElement('div')
      clozeTemp.innerHTML = match[0]      
      const clozeTextLength = clozeTemp.textContent.length
      const textEnd = textStart + clozeTextLength      

      const contentTemp = document.createElement('div')
      contentTemp.innerHTML = match[2]
      const contentText = contentTemp.textContent
      const contentTextLength = contentTemp.textContent.length
      const contentTextEnd = contentTextStart + contentTextLength
      

      let hintText = "";
      let hintTextLength = 0;    
      let hintTextStart = textEnd-2;
      let hintTextEnd = hintTextStart; 

      if( !(typeof match[3] === 'undefined') ) {
        const hintTemp = document.createElement('div')
        hintTemp.innerHTML = match[3]
        hintText = hintTemp.textContent
        hintTextLength = hintTemp.textContent.length
        hintTextStart = contentTextEnd + 2 
        hintTextEnd = hintTextStart + hintTextLength  
      }
      
      // Check if cursor is within this cloze's text range
      if (cursorPos >= textStart && cursorPos <= textEnd) {
        return {
          match: match[0],
          index: htmlStart,
          number: parseInt(match[1], 10),
          content: match[2],
          hint: match[3] || null,
          htmlStart: htmlStart,
          htmlEnd: htmlEnd,
          textStart: textStart,
          textEnd: textEnd,
          numberText: match[1], 
          contentHTML: match[2], 
          contentText: contentText, 
          contentTextStart: contentTextStart,
          contentTextEnd: contentTextEnd,
          contentTextLength: contentTextLength,
          hintHTML: match[3] || null, 
          hintText: hintText,
          hintTextStart: hintTextStart,
          hintTextEnd: hintTextEnd,
          hintTextLength: hintTextLength
        }
      }
    }

    return null
  }

  /**
   * Get all clozes in an element
   * @param {HTMLElement} elem - The editable field element
   * @returns {Array} - Array of cloze objects
   */
  function getAllClozes(elem) {
    const html = elem.innerHTML
    const clozes = []
    let match
    const regex = new RegExp(CLOZE_REGEX.source, 'g')

    while ((match = regex.exec(html)) !== null) {
      clozes.push({
        match: match[0],
        index: match.index,
        number: parseInt(match[1], 10),
        content: match[2],
        hint: match[3] || null
      })
    }

    return clozes
  }

  /**
   * Remove cloze markup from a cloze string, keeping the content
   * @param {string} clozeStr - The full cloze string e.g. "{{c1::Apple::fruit}}"
   * @returns {string} - Just the content e.g. "Apple"
   */
  function stripClozeMarkup(clozeStr) {
    const match = clozeStr.match(/\{\{c\d+::(.*?)(?:::.*?)?\}\}/)
    return match ? match[1] : clozeStr
  }

  /**
   * Remove cloze at cursor or remove clozes in selection
   * Ctrl+Shift+R
   */
  function removeClozeAtCursorOrSelection(event, elem) {
    const selection = window.getSelection()

    // Check if there's a selection
    if (selection && !selection.isCollapsed) {
      // Remove all cloze markup within the selection
      const range = selection.getRangeAt(0)
      const selectedHtml = getSelectionHtml()

      if (!selectedHtml) return

      // Replace clozes in selection with their content
      const newHtml = selectedHtml.replace(CLOZE_REGEX, '$2')

      if (newHtml !== selectedHtml) {
        document.execCommand('insertHTML', false, newHtml)
      }
    } else {
      // No selection - find cloze at cursor
      const cloze = getClozeAtCursor(elem)

      if (!cloze) {
        // No cloze at cursor
        return
      }

      // Replace this specific cloze with its content
      const html = elem.innerHTML
      const before = html.substring(0, cloze.htmlStart)
      const after = html.substring(cloze.htmlEnd)
      elem.innerHTML = before + cloze.content + after

      EFDRCE.CleanAndResize(elem)

      // Try to restore cursor position
      placeCursorAtOffset(elem, cloze.textStart)
    }
  }

  /**
   * Remove ALL cloze markup from the entire field
   */
  function removeAllClozesInField(event, elem) {
    const cursorPos = getCursorTextOffset(elem)

    // Replace all clozes - use same pattern as removeClozesOfSameNumber
    const html = elem.innerHTML
    const regex = /\{\{c\d+::(.*?)(?:::(.*?))?\}\}/g
    const newHtml = html.replace(regex, '$1')

    if (newHtml !== html) {
      elem.innerHTML = newHtml
      EFDRCE.CleanAndResize(elem)
      // Restore cursor approximately
      if (cursorPos >= 0) {
        placeCursorAtOffset(elem, Math.min(cursorPos, elem.textContent.length))
      }
    }
  }

  /**
   * Remove all clozes with the same number as the cloze at cursor
   * Ctrl+Shift+Alt+R
   */
  function removeClozesOfSameNumber(event, elem) {
    const cloze = getClozeAtCursor(elem)

    if (!cloze) {
      // No cloze at cursor
      return
    }

    const targetNumber = cloze.number
    const cursorPos = getCursorTextOffset(elem)

    // Replace all clozes with this number
    const html = elem.innerHTML
    const regex = new RegExp(`\\{\\{c${targetNumber}::(.*?)(?:::(.*?))?\\}\\}`, 'g')
    const newHtml = html.replace(regex, '$1')

    if (newHtml !== html) {
      elem.innerHTML = newHtml
      EFDRCE.CleanAndResize(elem)
      // Restore cursor approximately
      if (cursorPos >= 0) {
        placeCursorAtOffset(elem, Math.min(cursorPos, elem.textContent.length))
      }
    }
  }

  /**
   * Get HTML content of current selection
   */
  function getSelectionHtml() {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return ''

    const range = selection.getRangeAt(0)
    const container = document.createElement('div')
    container.appendChild(range.cloneContents())
    return container.innerHTML
  }

  /**
   * Place cursor at a text offset within an element
   */
  function placeCursorAtOffset(elem, offset) {
    const selection = window.getSelection()
    if (!selection) return

    // Ensure element has focus first
    elem.focus()

    const range = document.createRange()
    let currentOffset = 0
    let found = false

    function walkNodes(node) {
      if (found) return

      if (node.nodeType === Node.TEXT_NODE) {
        const nodeLength = node.textContent.length
        if (currentOffset + nodeLength >= offset) {
          range.setStart(node, offset - currentOffset)
          range.collapse(true)
          found = true
          return
        }
        currentOffset += nodeLength
      } else {
        for (const child of node.childNodes) {
          walkNodes(child)
          if (found) return
        }
      }
    }

    walkNodes(elem)

    if (found) {
      selection.removeAllRanges()
      selection.addRange(range)
    } else {
      // Fallback: place at end
      range.selectNodeContents(elem)
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }

  /**
   * Change the number of a cloze
   * @param {HTMLElement} elem - The editable field element
   * @param {Object} cloze - The cloze object from getClozeAtCursor
   * @param {number} newNumber - The new cloze number
   */
  function changeClozeNumber(elem, cloze, newNumber) {    
    const newCloze = cloze.hint
      ? `{{c${newNumber}::${cloze.content}::${cloze.hint}}}`
      : `{{c${newNumber}::${cloze.content}}}`

    const html = elem.innerHTML
    const before = html.substring(0, cloze.htmlStart)
    const after = html.substring(cloze.htmlEnd)    
    elem.innerHTML = before + newCloze + after
    
    EFDRCE.CleanAndResize(elem)

    // Restore cursor position
    placeCursorAtOffset(elem, cloze.textStart)
    return true
  }

  /**
   * Increment cloze number at cursor
   */
  function incrementClozeNumber(event, elem) {    
    const cloze = getClozeAtCursor(elem)
    if (!cloze) return

    changeClozeNumber(elem, cloze, cloze.number + 1)
  }

  /**
   * Decrement cloze number at cursor (minimum 1)
   */
  function decrementClozeNumber(event, elem) {
    const cloze = getClozeAtCursor(elem)
    if (!cloze) return

    const newNumber = Math.max(1, cloze.number - 1)
    if (newNumber !== cloze.number) {
      changeClozeNumber(elem, cloze, newNumber)
    }
  }

  // State for renumber key sequence
  let renumberPending = false
  let renumberElement = null
  let renumberCloze = null
  let renumberTimeout = null
  let renumberPopup = null

  /**
   * Create and show the renumber popup
   */
  function showRenumberPopup() {
    hideRenumberPopup()

    renumberPopup = document.createElement('div')
    renumberPopup.id = 'efdrce-renumber-popup'

    q1 = q("q_Press", `Press`)
    q2 = q("q_to_set_number", `to set number`)
    let night_mode = q("night_mode", "night_css")

    let night_html = `
      <div style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(15, 15, 15, 1);
        color: #fff;
        padding: 16px 24px;
        border: 1px solid rgba(128,128,128,0.7);
        border-radius: 8px;
        font-size: 16px;
        z-index: 99999;
        box-shadow: 0px 0px 16px rgba(255, 255, 255, 0.2);
        text-align: center;
      ">
        <div style="font-weight: bold; margin-bottom: 8px;">Renumber Cloze</div>
        <div style="color: #aaa;">${q1} <strong style="color: #fff;">1-9</strong> ${q2}</div>
        <div style="
          display: flex;
          justify-content: center;
          gap: 6px;
          margin-top: 12px;
        ">
          ${[1,2,3,4,5,6,7,8,9].map(n => `
            <span style="
              width: 28px;
              height: 28px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #555;
              border-radius: 4px;
              font-weight: bold;
            ">${n}</span>
          `).join('')}
        </div>
      </div>
    `
    
    let light_html = `
      <div style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #d6d5d5;
        color: #000;
        padding: 16px 24px;
        border-radius: 8px;
        font-size: 16px;
        z-index: 99999;
        box-shadow: 8px 8px 8px rgba(0,0,0,0.2);
        text-align: center;
      ">
        <div style="font-weight: bold; margin-bottom: 8px;">Renumber Cloze</div>
        <div style="color: #abaaaa;">${q1} <strong style="color: #000;">1-9</strong> ${q2}</div>
        <div style="
          display: flex;
          justify-content: center;
          gap: 6px;
          margin-top: 12px;
        ">
          ${[1,2,3,4,5,6,7,8,9].map(n => `
            <span style="
              width: 28px;
              height: 28px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #a9a9a9;
              border-radius: 4px;
              font-weight: bold;
            ">${n}</span>
          `).join('')}
        </div>
      </div>
    `
    if( night_mode == "night_css" ) {
      renumberPopup.innerHTML = night_html
    }
    else {
      renumberPopup.innerHTML = light_html
    }
    
    document.body.appendChild(renumberPopup)
  }

  /**
   * Hide the renumber popup
   */
  function hideRenumberPopup() {
    if (renumberPopup) {
      renumberPopup.remove()
      renumberPopup = null
    }
  }

  /**
   * Start renumber sequence - waits for 1-9 key press
   */
  function startRenumberSequence(event, elem) {
    const cloze = getClozeAtCursor(elem)
    if (!cloze) return  // No cloze at cursor, don't start

    renumberPending = true
    renumberElement = elem
    renumberCloze = cloze

    showRenumberPopup()

    // Cancel after 3 seconds if no number pressed
    clearTimeout(renumberTimeout)
    renumberTimeout = setTimeout(() => {
      renumberPending = false
      renumberElement = null
      renumberCloze = null
      hideRenumberPopup()
    }, 3000)
  }

  /**
   * Handle number key press during renumber sequence
   * Returns true if handled, false otherwise
   */
  function handleRenumberKey(event) {
    if (!renumberPending || !renumberElement || !renumberCloze) return false

    const key = event.key
    if (key >= '1' && key <= '9') {
      event.preventDefault()
      event.stopPropagation()

      const newNumber = parseInt(key, 10)
      changeClozeNumber(renumberElement, renumberCloze, newNumber)

      // Reset state
      clearTimeout(renumberTimeout)
      renumberPending = false
      renumberElement = null
      renumberCloze = null
      hideRenumberPopup()
      return true
    }

    // Any other key cancels the sequence
    renumberPending = false
    renumberElement = null
    renumberCloze = null
    clearTimeout(renumberTimeout)
    hideRenumberPopup()
    return false
  }


  // ============ CLOZE STRUCTURE ============


  /**
   * Split cloze at selection boundary
   * Select "family history" in {{c1::family history of ASCVD}}
   * → {{c1::family history}} {{c1::of ASCVD}}
   */  
  function splitCloze(event, elem) {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;    
    const cloze = getClozeAtCursor(elem);
    if (!cloze) return;

    const cursorPos = getCursorTextOffset(elem)
    const selectedText = selection.toString();
    let cursorPosEnd = cursorPos + selectedText.length;  
    
    let isMiddle = false;
    let isFromStart = false;
    let isToEnd = false;    
    let isFullSelection = false;

    if( cursorPos > cloze.contentTextStart && cursorPosEnd < cloze.contentTextEnd ) {
      isMiddle = true;
    }
    else if( cursorPos == cloze.contentTextStart && cursorPosEnd == cloze.contentTextEnd ) {
      isFullSelection = true;
    }
    else if( cursorPos <= cloze.contentTextStart && cursorPosEnd > cloze.contentTextStart ) {  
      isFromStart = true;
    }
    else if( cursorPos > cloze.contentTextStart && cursorPos < cloze.contentTextEnd && cursorPosEnd >= cloze.contentTextEnd ) {  
      isToEnd = true;
    }
    
    
    if (isFullSelection) {
        // We do nothing if the entire cloze is selected
        return;
    }

    const html = elem.innerHTML
    const before = html.substring(0, cloze.htmlStart)
    const after = html.substring(cloze.htmlEnd)
    const html_cloze = html.substring(cloze.htmlStart, cloze.htmlEnd) 


    function deletePosFromDocument(pos1, pos2) {
      placeCursorAtOffset(elem, pos1)
        const selection = window.getSelection();
        for (let i = 0; i < pos2 - pos1; i++) {
          selection.modify('extend', 'forward', 'character');
        }
        selection.deleteFromDocument();      
    }
    
    let newClozes = '';

    if (isFromStart) {
        // Selection from start or earlier
        let del1_start = cursorPosEnd
        let del1_end = cloze.contentTextEnd 
        let del2_start = cloze.contentTextStart + (cloze.textEnd-cloze.textStart)
        let del2_end = cursorPosEnd + (cloze.textEnd-cloze.textStart)
        newClozes += html_cloze;                
        elem.innerHTML = before + html_cloze + newClozes + after;
        EFDRCE.CleanAndResize(elem);        
        // deletion by position
        deletePosFromDocument(del2_start, del2_end)
        deletePosFromDocument(del1_start, del1_end)
        placeCursorAtOffset(elem, cloze.textStart); 
    } 
    else if (isToEnd) {
        // Selection to the end and possibly further
        let del1_start = cursorPos
        let del1_end = cloze.contentTextEnd 
        let del2_start = cloze.contentTextStart + (cloze.textEnd-cloze.textStart)
        let del2_end = cursorPos + (cloze.textEnd-cloze.textStart)
        newClozes += html_cloze;                
        elem.innerHTML = before + html_cloze + newClozes + after;
        EFDRCE.CleanAndResize(elem);        
        // deletion by position
        deletePosFromDocument(del2_start, del2_end)
        deletePosFromDocument(del1_start, del1_end)
        placeCursorAtOffset(elem, cloze.textStart); 
    }
    else if (isMiddle) {
        // Вhighlight in the middle:
        let del1_start = cursorPos
        let del1_end = cloze.contentTextEnd 
        
        let del2a_start = cloze.contentTextStart + (cloze.textEnd-cloze.textStart)
        let del2a_end = cursorPos + (cloze.textEnd-cloze.textStart)
        let del2b_start = cursorPosEnd + (cloze.textEnd-cloze.textStart)
        let del2b_end = cloze.contentTextEnd + (cloze.textEnd-cloze.textStart)

        let del3_start = cloze.contentTextStart + 2*(cloze.textEnd-cloze.textStart)
        let del3_end = cursorPosEnd + 2*(cloze.textEnd-cloze.textStart)
        newClozes += html_cloze;
        newClozes += html_cloze;
        elem.innerHTML = before + html_cloze + newClozes + after;
        EFDRCE.CleanAndResize(elem);        
        // deletion by position
        deletePosFromDocument(del3_start, del3_end)
        deletePosFromDocument(del2b_start, del2b_end)
        deletePosFromDocument(del2a_start, del2a_end)
        deletePosFromDocument(del1_start, del1_end)        
        placeCursorAtOffset(elem, cloze.textStart); 
    }
       
  }


  /**
   * Move text into an adjacent cloze.
   *
   * Select text that includes part of a cloze + adjacent text outside it.
   * The outside text is absorbed into that cloze.
   */
  function moveIntoCloze(event, elem) {    
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed || selection.toString().length === 0) {
      showMoveToast(q("q_Select_text_overlapping_a_cloze"))
      return
    }

    const html = elem.innerHTML
    const clozes = getClozesWithPositions(elem)
    if (clozes.length === 0) {
      showMoveToast(q("q_No_clozes_in_field"))
      return
    }

    const range = selection.getRangeAt(0)
    const pre = document.createRange()
    pre.selectNodeContents(elem)
    pre.setEnd(range.startContainer, range.startOffset)
    const selStart = pre.toString().length
    const selEnd = selStart + selection.toString().length

    // Find ALL clozes that overlap with selection
    const overlapping = clozes.filter(c => c.textStart < selEnd && c.textEnd > selStart)

    // Must overlap exactly one cloze
    if (overlapping.length === 0) {
      showMoveToast(q("q_Selection_must_overlap_a_cloze"))
      return
    }
    if (overlapping.length > 1) {
      showMoveToast(q("q_Selection_overlaps_multiple_clozes"))
      return
    }

    const cloze = overlapping[0]

    // Clamp so we don't extend into another cloze
    let absorbStart = selStart
    let absorbEnd = selEnd
    for (const c of clozes) {
      if (c === cloze) continue
      if (c.textEnd > absorbStart && c.textEnd <= cloze.textStart) {
        absorbStart = Math.max(absorbStart, c.textEnd)
      }
      if (c.textStart < absorbEnd && c.textStart >= cloze.textEnd) {
        absorbEnd = Math.min(absorbEnd, c.textStart)
      }
    }

    const beforeLen = Math.max(0, cloze.textStart - absorbStart)
    const afterLen = Math.max(0, absorbEnd - cloze.textEnd)
    if (beforeLen === 0 && afterLen === 0) {
      showMoveToast(q("q_Selection_overlaps_multiple_clozes"))
      return
    }

    saveUndoState(elem)

    function deletePosFromDocument(pos1, pos2) {
      placeCursorAtOffset(elem, pos1)
      const selection = window.getSelection();
      for (let i = 0; i < pos2 - pos1; i++) {
        selection.modify('extend', 'forward', 'character');
      }
      selection.deleteFromDocument();      
    }

    function copyFromDocument(pos1, pos2) {
      placeCursorAtOffset(elem, pos1)
      const selection = window.getSelection();
      for (let i = 0; i < pos2 - pos1; i++) {
        selection.modify('extend', 'forward', 'character');
      }
      document.execCommand("copy");  
    }

    function pasteHtml(pos){
      placeCursorAtOffset(elem, pos)
      window.pycmd('EFDRCE!pasteEXT') // python code accesses clipboard      
    }

    EFDRCE.CleanAndResize(elem)
    placeCursorAtOffset(elem, cloze.textStart)    
    const clozeEx = getClozeAtCursor(elem); // extended data on cloze


    if (afterLen > 0) {      
      let posCut1 = clozeEx.textEnd
      let posCut2 = clozeEx.textEnd
      let hintHTML = clozeEx.hintHTML       
      if(clozeEx.hintTextLength == 0) posCut1 -= 2;
      else posCut1 -= clozeEx.hintTextLength + 4;      
      copyFromDocument(posCut1, posCut2)      
      setTimeout( ()=>{
        pasteHtml(selEnd)
        setTimeout( ()=>{deletePosFromDocument(posCut1, posCut2)}, 20)
      }, 20)     
    }

    if (beforeLen > 0) {      
      if(afterLen > 0) {
        setTimeout( ()=>{
          let posCut1 = clozeEx.textStart
          let posCut2 = clozeEx.contentTextStart      
          copyFromDocument(posCut1, posCut2)      
          setTimeout( ()=>{
            deletePosFromDocument(posCut1, posCut2)          
            setTimeout( ()=>{pasteHtml(selStart)}, 20);
          }, 20);
        }, 40);
      }
      else {
        let posCut1 = clozeEx.textStart
        let posCut2 = clozeEx.contentTextStart      
        copyFromDocument(posCut1, posCut2)      
        setTimeout( ()=>{
          deletePosFromDocument(posCut1, posCut2)          
          setTimeout( ()=>{pasteHtml(selStart)}, 20);
        }, 20);
      }
    }

  }
  

  /**
   * Merge adjacent same-number clozes (including text between them)
   * {{c1::one}} two {{c1::three}} → {{c1::one two three}}
   */
  function mergeClozes(event, elem) {
    const cloze = getClozeAtCursor(elem)
    if (!cloze) return

    const html = elem.innerHTML
    const allClozes = getAllClozes(elem)

    // Find all clozes with same number
    const sameClozes = allClozes.filter(c => c.number === cloze.number)
    if (sameClozes.length <= 1) return // Nothing to merge

    // Find the first and last cloze with this number
    const firstCloze = sameClozes[0]
    const lastCloze = sameClozes[sameClozes.length - 1]

    // Get everything between first cloze start and last cloze end
    const betweenHtml = html.substring(firstCloze.index, lastCloze.index + lastCloze.match.length)

    // Extract all content: replace cloze markup with content, keep text between
    const mergedContent = betweenHtml.replace(/\{\{c\d+::(.*?)(?:::.*?)?\}\}/g, '$1')

    // Use hint from first cloze that has one, or none
    const hintCloze = sameClozes.find(c => c.hint)
    const hint = hintCloze ? `::${hintCloze.hint}` : ''

    // Build merged cloze
    const newCloze = `{{c${cloze.number}::${mergedContent}${hint}}}`

    // Replace in HTML
    const before = html.substring(0, firstCloze.index)
    const after = html.substring(lastCloze.index + lastCloze.match.length)
    elem.innerHTML = before + newCloze + after
    EFDRCE.CleanAndResize(elem)

    // Position cursor at start of merged cloze
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = before
    placeCursorAtOffset(elem, tempDiv.textContent.length)
  }


  /**
   * Move selected text out of cloze
   * Smart: start→before, end→after, middle→split
   */
  function moveOutOfCloze(event, elem) {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return

    const cloze = getClozeAtCursor(elem)
    if (!cloze) return

    const selectedText = selection.toString()
    if (!selectedText) return


    const cursorPos = getCursorTextOffset(elem)   
    let cursorPosEnd = cursorPos + selectedText.length;  
    
    let isMiddle = false;
    let isFromStart = false;
    let isToEnd = false;    
    let isFullSelection = false;

    if( cursorPos > cloze.contentTextStart && cursorPosEnd < cloze.contentTextEnd ) {
      isMiddle = true;
    }
    else if( cursorPos <= cloze.contentTextStart && cursorPosEnd >= cloze.contentTextEnd ) {
      isFullSelection = true;
    }
    else if( cursorPos <= cloze.contentTextStart && cursorPosEnd > cloze.contentTextStart ) {  
      isFromStart = true;
    }
    else if( cursorPos > cloze.contentTextStart && cursorPos < cloze.contentTextEnd && cursorPosEnd >= cloze.contentTextEnd ) {  
      isToEnd = true;
    }
    
    
    if (isFullSelection) {      
      placeCursorAtOffset(elem, cloze.contentTextStart)
      removeClozeAtCursorOrSelection(event, elem)
    }
    else if (isMiddle) {
      splitCloze(event, elem)
      jumpToNextCloze(event, elem)
      removeClozeAtCursorOrSelection(event, elem)
    }
    else if (isFromStart) {
      splitCloze(event, elem)      
      removeClozeAtCursorOrSelection(event, elem)
    }
    else if (isToEnd) {
      splitCloze(event, elem)
      jumpToNextCloze(event, elem)
      removeClozeAtCursorOrSelection(event, elem)
    }

    return
  }

 


  /**
 * Convert selected image to cloze
 * <img src="..."> or <div class="ui-wrapper"><img src="..."></div> → {{c1::...}}
 */  
  function imageToCloze(event, elem) { 
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return

      const range = selection.getRangeAt(0)
      
      // Function for finding wrapper in selection
      function findWrapperInSelection() {
          // 1. We check range.startContainer itself and its parents
          let node = range.startContainer
          while (node && node !== document.body) {
              if (node.nodeType === Node.ELEMENT_NODE && 
                  node.classList && 
                  node.classList.contains('ui-wrapper')) {
                  return node
              }
              node = node.parentNode
          }
          
          // 2. Checking commonAncestorContainer and its parents
          node = range.commonAncestorContainer
          while (node && node !== document.body) {
              if (node.nodeType === Node.ELEMENT_NODE && 
                  node.classList && 
                  node.classList.contains('ui-wrapper')) {
                  return node
              }
              node = node.parentNode
          }
          
          // 3. Checking the contents of range for the presence of a wrapper
          const rangeContent = range.cloneContents()
          const wrapper = rangeContent.querySelector('div.ui-wrapper')
          if (wrapper) {
              // Finding the appropriate wrapper in the DOM
              const allWrappers = elem.querySelectorAll('div.ui-wrapper')
              for (const w of allWrappers) {
                  if (w.isSameNode(wrapper) || w.outerHTML === wrapper.outerHTML) {
                      return w
                  }
              }
          }
          
          // 4. We are looking for a wrapper that intersects with the selection
          const allWrappers = elem.querySelectorAll('div.ui-wrapper')
          for (const wrapper of allWrappers) {
              if (selection.containsNode(wrapper, true)) {
                  return wrapper
              }
          }
          
          return null
      }
      
      // Function to check if an element is already in cloze
      function isAlreadyInCloze(element) {
          const html = elem.innerHTML
          const elementHtml = element.outerHTML
          const elementIndex = html.indexOf(elementHtml)
          
          if (elementIndex === -1) return false
          
          // We are looking for cloze in front of this position
          const beforeHtml = html.substring(0, elementIndex)
          const lastClozeStart = beforeHtml.lastIndexOf('{{c')
          const lastClozeEnd = beforeHtml.lastIndexOf('}}')
          
          // If there is an unclosed cloze before the element
          if (lastClozeStart > lastClozeEnd && lastClozeStart !== -1) {
              // Check if this cloze closes after the element
              const afterHtml = html.substring(elementIndex)
              const nextClozeEnd = afterHtml.indexOf('}}')
              
              if (nextClozeEnd !== -1) {
                  // The element is between {{c...:: and }}
                  return true
              }
          }
          
          return false
      }
      
      // 1. We are looking for a wrapper
      let wrapper = findWrapperInSelection()
      
      if (wrapper) {
          // Checking if the wrapper is already in cloze
          if (isAlreadyInCloze(wrapper)) {
              showToast(q("q_Image_already_in_the_cloze"))              
              return
          }
          
          // Showing debugging
          console.log('Found wrapper:', wrapper)
          //showToast('Found wrapper: ' + wrapper.outerHTML.substring(0, 100), 'info')
          
          // Find the next number cloze
          let highest = 0
          const html = elem.innerHTML
          const myRe = /\{\{c(\d+)::/g
          let match
          while ((match = myRe.exec(html)) !== null) {
              highest = Math.max(highest, parseInt(match[1], 10))
          }
          const clozeNumber = Math.max(1, highest + 1)
          
          // Creating a cloze with a wrapper
          const wrapperHtml = wrapper.outerHTML
          const clozeContent = `{{c${clozeNumber}::${wrapperHtml}}}`
          
          // Replaceable cloze wrapper
          elem.innerHTML = elem.innerHTML.replace(wrapperHtml, clozeContent)
          
          // Clear resize
          EFDRCE.CleanAndResize(elem)
          
          showToast(`${q("q_Image_added_to_cloze")} N=${clozeNumber}`)
                    
          return
      }
      
      

      // 2. If you haven't found a wrapper, look for a simple image
      let img = null
      
      // Checking the selection for the presence of img
      const rangeContent = range.cloneContents()
      const imgInRange = rangeContent.querySelector('img')
      if (imgInRange) {
          // Find the corresponding img in the DOM
          const allImgs = elem.querySelectorAll('img')
          for (const i of allImgs) {
              if (i.isSameNode(imgInRange) || i.outerHTML === imgInRange.outerHTML) {
                  img = i
                  break
              }
          }
      }
      

      // If not found in range, check all images
      if (!img) {
          const allImgs = elem.querySelectorAll('img')
          for (const testImg of allImgs) {
              if (selection.containsNode(testImg, true)) {
                  img = testImg
                  break
              }
          }
      }

      
      
      if (!img) {          
          showToast(q("q_Image_not_found_to_add_to_cloze"))          
          return
      }
      
      
      // Checking if img is already in cloze
      if (isAlreadyInCloze(img)) {
          showToast(q("q_Image_already_in_the_cloze"))          
          return
      }
      
      // Find the next number cloze
      let highest = 0
      const html = elem.innerHTML
      const myRe = /\{\{c(\d+)::/g
      let match
      while ((match = myRe.exec(html)) !== null) {
          highest = Math.max(highest, parseInt(match[1], 10))
      }
      const clozeNumber = Math.max(1, highest + 1)
      
      // Create cloze with img
      const imgHtml = img.outerHTML
      const clozeContent = `{{c${clozeNumber}::${imgHtml}}}`
      
      

      // Replaceable cloze img
      elem.innerHTML = elem.innerHTML.replace(imgHtml, clozeContent)
      
      // Clear resize
      EFDRCE.CleanAndResize(elem)
      
      showToast(`${q("q_Image_added_to_cloze")} N=${clozeNumber}`)      
  }


  /**
   * Walk forward through HTML from a position, counting text characters.
   * Returns the HTML position after consuming N text characters.
   */
  function walkHtmlForward(html, fromPos, textChars) {
    let remaining = textChars
    let i = fromPos
    while (i < html.length && remaining > 0) {
      if (html[i] === '<') {
        while (i < html.length && html[i] !== '>') i++
        i++
        continue
      }
      if (html[i] === '&') {
        const semi = html.indexOf(';', i)
        if (semi !== -1 && semi - i < 10) {
          remaining--
          i = semi + 1
          continue
        }
      }
      remaining--
      i++
    }
    return i
  }

  /**
   * Walk backward through HTML from a position, counting text characters.
   * Returns the HTML position of the Nth text character before fromPos.
   */
  function walkHtmlBackward(html, fromPos, textChars) {
    let remaining = textChars
    let i = fromPos - 1
    while (i >= 0 && remaining > 0) {
      if (html[i] === '>') {
        while (i >= 0 && html[i] !== '<') i--
        i--
        continue
      }
      if (html[i] === ';') {
        let j = i - 1
        while (j >= Math.max(0, i - 8) && html[j] !== '&') j--
        if (j >= 0 && html[j] === '&') {
          remaining--
          if (remaining === 0) return j
          i = j - 1
          continue
        }
      }
      remaining--
      if (remaining === 0) return i
      i--
    }
    return Math.max(0, i + 1)
  }

  /**
   * Show a brief toast message that auto-dismisses.
   */
  function showMoveToast(message) {
    const existing = document.getElementById('efdrce-move-toast')
    if (existing) existing.remove()
    const toast = document.createElement('div')
    toast.id = 'efdrce-move-toast'
    toast.textContent = message

    let night_css = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: #2a2a2a; color: #888; border-radius: 8px; padding: 8px 16px;
      font-size: 13px; z-index: 99999; box-shadow: 0px 0px 16px rgba(255,255,255,0.2);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `
    let light_css = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: #d8d8d8; color: #000000; border-radius: 8px; padding: 8px 16px;
      font-size: 13px; z-index: 99999; box-shadow: 8px 8px 8px rgba(0,0,0,0.2);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `
    let theme_css = night_css 
    let night_mode = q("night_mode", "night_css")
    if(night_mode == "light_css") theme_css = light_css;  
    toast.style.cssText = theme_css
    
    document.body.appendChild(toast)
    setTimeout(() => { if (toast.parentNode) toast.remove() }, 1500)
  }

  /**
   * Build a unified cloze list with text positions from textContent
   * (same coordinate space as getCursorTextOffset / Range.toString)
   * and HTML positions from innerHTML (for replacement).
   */
  function getClozesWithPositions(elem) {
    const fullText = elem.textContent || ''
    const html = elem.innerHTML

    // Text positions — same coordinate space as cursor
    const textClozes = []
    const textRegex = new RegExp(CLOZE_REGEX.source, 'g')
    let tm
    while ((tm = textRegex.exec(fullText)) !== null) {
      textClozes.push({
        textStart: tm.index,
        textEnd: tm.index + tm[0].length,
        number: parseInt(tm[1], 10),
        textContent: tm[2],
        textHint: tm[3] || null
      })
    }

    // HTML positions — for innerHTML manipulation
    const htmlClozes = getAllClozes(elem)

    // If counts match, pair them up (best case)
    if (textClozes.length === htmlClozes.length) {
      return textClozes.map((tc, i) => ({
        textStart: tc.textStart,
        textEnd: tc.textEnd,
        number: tc.number,
        content: htmlClozes[i].content,
        hint: htmlClozes[i].hint,
        htmlStart: htmlClozes[i].index,
        htmlEnd: htmlClozes[i].index + htmlClozes[i].match.length,
        htmlMatch: htmlClozes[i].match
      }))
    }

    // Fallback: use getClozeTextPosition (temp div method) if counts differ
    return htmlClozes.map(c => {
      const pos = getClozeTextPosition(elem, c)
      return {
        textStart: pos.textStart,
        textEnd: pos.textEnd,
        number: c.number,
        content: c.content,
        hint: c.hint,
        htmlStart: c.index,
        htmlEnd: c.index + c.match.length,
        htmlMatch: c.match
      }
    })
  }
  
  

  // ============ CLOZE NAVIGATION ============

  /**
   * Get text position info for a cloze
   */
  function getClozeTextPosition(elem, cloze) {
    const html = elem.innerHTML
    const htmlBefore = html.substring(0, cloze.index)
    const temp = document.createElement('div')
    temp.innerHTML = htmlBefore
    const textStart = temp.textContent.length

    // Get text length of the cloze content
    const clozeTemp = document.createElement('div')
    clozeTemp.innerHTML = cloze.match
    const clozeTextLen = clozeTemp.textContent.length
    const textEnd = textStart + clozeTextLen

    return { textStart, textEnd }
  }

  /**
   * Jump to the previous cloze in field (cursor at end of cloze content)
   */
  function jumpToPrevCloze(event, elem) {
    const cursorPos = getCursorTextOffset(elem)
    if (cursorPos < 0) return

    const allClozes = getAllClozes(elem)
    if (allClozes.length === 0) return

    // Calculate text positions for all clozes
    const clozePositions = allClozes.map(cloze => {
      const pos = getClozeTextPosition(elem, cloze)
      return { cloze, ...pos }
    })

    //We are looking for the very last clause that is located BEFORE the cursor
    //At the same time, we want to skip the clause in which the cursor is already located
    for (let i = clozePositions.length - 1; i >= 0; i--) {
      const pos = clozePositions[i]
      
      //If the cursor is AFTER the end of this clause
      //(not inside or at the beginning)
      if (cursorPos > pos.textEnd) {
        placeCursorAtOffset(elem, pos.textEnd)
        return
      }
      //If the cursor is BETWEEN the start and end of the clause
      //(inside a clause), look for the previous clause
      else if (cursorPos > pos.textStart && cursorPos <= pos.textEnd) {
        // If there is a previous clause
        if (i > 0) {
          const prevPos = clozePositions[i - 1]
          placeCursorAtOffset(elem, prevPos.textEnd)
          return
        }
      }
    }

    // Wrap around to last cloze (cursor in front of all clauses)
    const lastPos = clozePositions[clozePositions.length - 1]
    placeCursorAtOffset(elem, lastPos.textEnd)
  }

  /**
   * Jump to the next cloze in field (cursor at end of cloze content)
   */
  function jumpToNextCloze(event, elem) {
    const cursorPos = getCursorTextOffset(elem)
    if (cursorPos < 0) return

    const allClozes = getAllClozes(elem)
    if (allClozes.length === 0) return

    // Find the next cloze after cursor position
    for (const cloze of allClozes) {
      const pos = getClozeTextPosition(elem, cloze)

      if (pos.textStart > cursorPos) {
        // Place cursor at end of cloze content
        placeCursorAtOffset(elem, pos.textEnd)
        return
      }
    }

    // Wrap around to first cloze
    const firstCloze = allClozes[0]
    const pos = getClozeTextPosition(elem, firstCloze)
    placeCursorAtOffset(elem, pos.textEnd)
  }

  /**
   * Jump to beginning of current cloze (before {{)
   * If cursor is not in a cloze, find next cloze and jump to its beginning
   */
  function jumpToBegCloze(event, elem) {
      const cursorPos = getCursorTextOffset(elem);
      if (cursorPos < 0) return;
      
      // Check if we're inside a cloze
      const currentCloze = getClozeAtCursor(elem);
      
      if (currentCloze) {
          // We're inside a cloze, jump to its beginning
          placeCursorAtOffset(elem, currentCloze.textStart);
          return;
      }
      
      // Not inside a cloze, find next cloze
      const allClozes = getAllClozes(elem);
      if (allClozes.length === 0) return;
      
      // Convert to text positions and sort
      const clozePositions = allClozes.map(cloze => {
          const pos = getClozeTextPosition(elem, cloze);
          return { cloze, ...pos };
      }).sort((a, b) => a.textStart - b.textStart);
      
      // Find the first cloze that starts AFTER the cursor
      for (const pos of clozePositions) {
          if (pos.textStart > cursorPos) {
              placeCursorAtOffset(elem, pos.textStart);
              return;
          }
      }
      
      // Wrap around to first cloze
      if (clozePositions.length > 0) {
          placeCursorAtOffset(elem, clozePositions[0].textStart);
      }
  }

  /**
   * Jump to end of current cloze (after }})
   * If cursor is not in a cloze, find previous cloze and jump to its end
   */
  function jumpToEndCloze(event, elem) {
      const cursorPos = getCursorTextOffset(elem);
      if (cursorPos < 0) return;
      
      // Check if we're inside a cloze
      const currentCloze = getClozeAtCursor(elem);
      
      if (currentCloze) {
          // We're inside a cloze, jump to its end
          placeCursorAtOffset(elem, currentCloze.textEnd);
          return;
      }
      
      // Not inside a cloze, find previous cloze
      const allClozes = getAllClozes(elem);
      if (allClozes.length === 0) return;
      
      // Convert to text positions and sort
      const clozePositions = allClozes.map(cloze => {
          const pos = getClozeTextPosition(elem, cloze);
          return { cloze, ...pos };
      }).sort((a, b) => a.textStart - b.textStart);
      
      // Find the last cloze that ends BEFORE the cursor
      for (let i = clozePositions.length - 1; i >= 0; i--) {
          const pos = clozePositions[i];
          if (pos.textEnd < cursorPos) {
              placeCursorAtOffset(elem, pos.textEnd);
              return;
          }
      }
      
      // Wrap around to last cloze
      if (clozePositions.length > 0) {
          const lastPos = clozePositions[clozePositions.length - 1];
          placeCursorAtOffset(elem, lastPos.textEnd);
      }
  }

  /**
   * Jump to beginning of field
   */
  function jumpToBeginning(event, elem) {
    placeCursorAtOffset(elem, 0)
  }

  /**
   * Jump to end of field
   */
  function jumpToEnd(event, elem) {
    const len = elem.textContent ? elem.textContent.length : 0
    placeCursorAtOffset(elem, len)
  }

  // ============ VISUAL FEATURES ============

  // Color palette for cloze numbers
  const CLOZE_COLORS = {
    1: '#4fc3f7', // blue
    2: '#81c784', // green
    3: '#e57373', // red
    4: '#ffb74d', // orange
    5: '#ba68c8', // purple
    6: '#4dd0e1', // cyan
    7: '#fff176', // yellow
    8: '#f06292', // pink
    9: '#a1887f'  // brown
  }

  function getClozeColor(num) {
    return CLOZE_COLORS[num] || '#90a4ae' // default gray
  }

  // ============== VIEW HTML ===================================
  
  // Escapes HTML to be safely displayed as text
  function escapeHTML(str) {
    if (!str) return '';    
    return str
      .replace(/\n/g, '↵') // enter
      .replace(/\t/g, '→') // tab
      .replace(/ /g, '␣') // &nbsp;
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // compresses HTML as much as possible to count as text
  function html_to_text(str) {
    if (!str) return ''; 
    return str      
      .replace(/&nbsp;/g, ' ') 
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
  

  /**
   * Gets the path to the node as an array of indexes
   */
  function getNodePath(root, node) {
    const path = [];
    let current = node;
    
    while (current && current !== root) {
      const parent = current.parentNode;
      if (!parent) break;
      
      const children = Array.from(parent.childNodes);
      const index = children.indexOf(current);
      path.unshift(index);
      
      current = parent;
    }
    
    return path;
  }

  /**
   * Finds a node along the path in the clone
   */
  function getNodeAtPath(root, path) {
    let node = root;
    
    for (const index of path) {
      if (!node.childNodes || index >= node.childNodes.length) {
        return null;
      }
      node = node.childNodes[index];
    }
    
    return node;
  }


  function getHtmlWithCaret(root) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {      
      return root.innerHTML;
    }

    const range = sel.getRangeAt(0);
    
    const cloneRoot = root.cloneNode(true); // deep cloning
    // Finding the corresponding cursor position in the clone
    //To do this, we need to match the paths to the nodes
    // We get the path to the node in the original
    const path = getNodePath(root, range.startContainer);
    const offset = range.startOffset;
    // Finding the same node in the clone
    const cloneNode = getNodeAtPath(cloneRoot, path);
    if (!cloneNode) {      
      // If the path is not found, we simply return HTML
      return escapeHTML(root.innerHTML);
    }

    // Creating a time range in a clone
    const cloneRange = document.createRange();
    cloneRange.setStart(cloneNode, offset);

    

    // create a unique marker
    const marker = document.createElement("span");
    marker.id = "___CARET_20260213_MARKER___";
    marker.style.display = "inline";
    markerHtml = marker.outerHTML;

    //insert it at the cursor position
    cloneRange.insertNode(marker);
    // we get HTML
    let html = cloneRoot.innerHTML;
    // remove the marker
    marker.remove();

    html = html_to_text(html)
    let index = html.indexOf(markerHtml);
    if( index < 0) index = 0;
    html = html.replace(markerHtml,'')
    const maxLenStr = 40
    idx1 = index - maxLenStr
    if(idx1 < 0) idx1 = 0
    let beforeHtml = html.slice(idx1, index);    
    let afterHtml = html.slice(index, index + maxLenStr);    
    let beforeTextHtml = escapeHTML(beforeHtml)
    let afterTextHtml = escapeHTML(afterHtml)    
    let cursorHtml = "&nbsp;<span style='color: red; font-weight: bold; font-size: 16px; margin-left: -0.75em; margin-right: -0.75em;'>|</span>&nbsp;"            
    return beforeTextHtml  + cursorHtml  + afterTextHtml 
  }
  // ================================================================


  // Overlay state
  let clozeOverlay = null
  var clozeOverlayEnabled = false // Will be set from config in setupClozeTools
  var clozeOverlayHTMLEnabled = false
  let clozeOverlayFieldId = null

  /**
   * Create or update the cloze info overlay
   */
  function showClozeOverlay(elem) {
    if (!clozeOverlayEnabled) return

    const fieldId = elem.getAttribute('data-EFDRCEfield')
    clozeOverlayFieldId = fieldId

    if (!clozeOverlay) {
      clozeOverlay = document.createElement('div')
      clozeOverlay.id = 'efdrce-cloze-overlay'

      let night_css = `
        position: fixed;
        bottom: 10px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(15, 15, 15, 0.95);
        color: #fff;
        padding: 8px 14px;
        border: 1px solid rgba(128,128,128,0.7);
        border-radius: 16px;
        font-size: 12px;
        z-index: 99998;
        box-shadow: 0px 0px 16px rgba(255, 255, 255, 0.2);
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        display: flex;
        flex-direction: column;  
        align-items: center;     
        align-items: stretch;
        justify-content: center;
        gap: 4px;                 /* Space between elements */        
        width: 800px;
        max-width: 95%;
      `
      
      let light_css = `
        position: fixed;
        bottom: 10px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(240, 240, 240, 0.98);
        color: #000000;
        padding: 8px 14px;
        border: 1px solid rgba(0,0,0,0.1);
        border-radius: 16px;
        font-size: 12px;
        z-index: 99998;
        box-shadow: 0px 2px 8px rgba(0,0,0,0.1);
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        display: flex;
        flex-direction: column;  
        align-items: center;      
        align-items: stretch;   
        justify-content: center;  
        gap: 4px;                 /* Space between elements */
        width: 800px;
        max-width: 95%;
      `


      let theme_css = night_css
      let night_mode = q("night_mode", "night_css")
      if(night_mode == "light_css") theme_css = light_css;      
      clozeOverlay.style.cssText = theme_css
      
      document.body.appendChild(clozeOverlay)
    }

    updateClozeOverlay(elem)
  }

  function hideClozeOverlay() {
    if (clozeOverlay) {
      clozeOverlay.remove()
      clozeOverlay = null
    }
    clozeOverlayFieldId = null
  }

  function updateClozeOverlay(elem) {
    if (!clozeOverlay || !clozeOverlayEnabled) return

    const allClozes = getAllClozes(elem)
    const clozeAtCursor = getClozeAtCursor(elem)

    // Count clozes by number
    const counts = {}
    let hasEmpty = false
    let hasLong = false
    const maxLength = EFDRCE.CONF?.cloze_tools?.max_cloze_length || 50

    for (const cloze of allClozes) {
      counts[cloze.number] = (counts[cloze.number] || 0) + 1

      const temp = document.createElement('div')
      temp.innerHTML = cloze.content
      const plainContent = (temp.textContent || '').trim()
      if (!plainContent) hasEmpty = true
      if (plainContent.length > maxLength) hasLong = true
    }

    // Build compact display - just colored badges
    let html = ''
    const sortedNums = Object.keys(counts).map(n => parseInt(n)).sort((a, b) => a - b)

    let q1 = q("q_warning_Empty", `Empty`)
    let q2 = q("q_warning_Long", `Long`)
    let q3 = q("q_warning_No_clozes", `No clozes`)
    let night_mode = q("night_mode", "night_css")
        
    for (const num of sortedNums) {
      const color = getClozeColor(num)
      const isActive = clozeAtCursor && clozeAtCursor.number === num
      let style = isActive
        ? `background: ${color}; color: #000; font-weight: 700;`
        : `background: rgb(210, 210, 210); color: ${color}; font-weight: 600;`
      if( night_mode != "night_css" ) {
        style = isActive
          ? `background: ${color}; color: #000; font-weight: 700;`
          : `background: rgb(154, 154, 154); color: ${color}; font-weight: 600;`
      }
      
      
      html += `<span style="${style} padding: 2px 8px; border-radius: 10px; font-size: 12px;">c${num}</span>`
    }

    // Only show warnings if they exist
    if (hasEmpty) {      
      html += `<span style="color: #e57373; font-size: 11px;">⚠ ${q1}</span>`      
    }

    if (hasLong) {
      html += `<span style="color: #ffb74d; font-size: 11px;">⚠ ${q2}</span>`
    }

    // If no clozes at all
    if (sortedNums.length === 0) {      
      html += `<span style="color: #666; font-size: 12px;">${q3}</span>`
    }

    clozeOverlayinnerHTML = `
    <div style="
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      flex-wrap: wrap;
      gap: 4px;
      width: 100%;
    ">${html}</div>`

    // display HTML by cursor position
    let htmlCar = ''        
    if(clozeOverlayHTMLEnabled) {
      htmlCar = getHtmlWithCaret(elem)  
      clozeOverlayinnerHTML += `  
    <pre style="
      font-family: monospace;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-size: 14px;
      margin: 2px 0;
      padding: 4px;
      background: ${night_mode === 'night_css' ? 'rgba(15, 15, 15, 0.95)' : 'rgba(240, 240, 240, 0.98)'};
      border-radius: 4px;
      white-space: pre-wrap;
      word-wrap: break-word;
      width: 100%;
    ">${htmlCar}</pre>`;
    } 
        
    clozeOverlay.innerHTML = clozeOverlayinnerHTML;
  }


  /**
   * Toggle cloze overlay visibility
   */
  function toggleClozeOverlay(event, elem) {  
    if(EFDRCE.CONF?.cloze_tools?.auto_show_overlay) {
      clozeOverlayEnabled = EFDRCE.CONF.cloze_tools.auto_show_overlay 
      clozeOverlayEnabled = !clozeOverlayEnabled
      EFDRCE.CONF.cloze_tools.auto_show_overlay = clozeOverlayEnabled      
    }
    else {
      clozeOverlayEnabled = !clozeOverlayEnabled  
    }  

    // Find active field if not provided
    if (!elem || !elem.hasAttribute || !elem.hasAttribute('data-EFDRCEfield')) {
      elem = document.querySelector('[data-EFDRCEfield][contenteditable="true"]:focus')
      if (!elem) {
        elem = document.querySelector('[data-EFDRCEfield]')
      }
    }

    if (clozeOverlayEnabled && elem) {
      showClozeOverlay(elem)
    } else {
      hideClozeOverlay()
    }
  }

  /**
   * Update overlay on cursor movement (called from selection change)
   */
  let timer1_updateClozeOverlay = null;
  function onSelectionChange() {
    if (!clozeOverlayEnabled || !clozeOverlayFieldId) {
      return
    }

    if(timer1_updateClozeOverlay) {
      clearTimeout(timer1_updateClozeOverlay)      
    }

    timer1_updateClozeOverlay = setTimeout( ()=> {
      try{
        // It is permissible to display more than one field with the same name!
        const elements = document.querySelectorAll(`[data-EFDRCEfield="${clozeOverlayFieldId}"]`);
        if (elements.length === 0) return;

        let activeElem = null;
        for (const el of elements) {
          if (document.activeElement === el) {
            activeElem = el;
            break;
          }
        }
        
        if (activeElem) {
          updateClozeOverlay(activeElem)
        }
      } catch (error) {}
      timer1_updateClozeOverlay = null;  
    }, 30) 
    
  }

  // Listen for selection changes to update active cloze indicator
  document.addEventListener('selectionchange', onSelectionChange)

  
  // processing and when deleting
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      onSelectionChange(); //will definitely work in 30 ms when it is deleted     
    }
  }, true);


  /**
   * Setup visual features when field gains focus
   */
  function setupVisualFeatures(elem) {
    const autoShow = EFDRCE.CONF?.cloze_tools?.auto_show_overlay
    if (autoShow || clozeOverlayEnabled) {
      clozeOverlayEnabled = true
      showClozeOverlay(elem)
    }
  }

  /**
   * Cleanup visual features when field loses focus
   */
  function cleanupVisualFeatures(elem) {
    hideClozeOverlay()
    // Clear suggestions when leaving field
    if (suggestionsEnabled) {
      hideSuggestions(elem)
    }
  }

  // ============ ADVANCED EDITING ============

  /**
   * Copy the inner content of cloze at cursor to clipboard
   * {{c1::Apple::hint}} → copies "Apple"
   */
  function copyClozeContent(event, elem) {    
    const cloze = getClozeAtCursor(elem);
    if (!cloze) return;    
    placeCursorAtOffset(elem, cloze.contentTextStart);

    // Calculate how many “characters” need to be allocated
    const temp = document.createElement('div');
    temp.innerHTML = cloze.content;
    const charsToSelect = temp.textContent.length;

    expandSelectionByCharacters(charsToSelect);

    document.execCommand('copy');
    showToast(q("q_Cloze_content_copied"));

    // Deselecting
    // setTimeout(() => {   LET THE USER DECIDE WHETHER TO DELETE OR WHICH WAY TO REMOVE THE SELECTION
    //   const selection = window.getSelection()
    //   selection.removeAllRanges();
    //   // Place the cursor after the copied text
    //   placeCursorAtOffset(elem, cloze.contentTextStart + charsToSelect);
    // }, 100);

    function expandSelectionByCharacters(charCount) {
      const selection = window.getSelection();      
      // Using the modify method to expand the selection
      //"extend" -expand the current selection "forward" -direction "character" -unit of measurement
      for (let i = 0; i < charCount; i++) {
        selection.modify('extend', 'forward', 'character');
      }
    }
  }
  

  function showToast(message) {
    const existing = document.getElementById('efdrce-toast')
    if (existing) existing.remove()

    const toast = document.createElement('div')
    toast.id = 'efdrce-toast'
    toast.textContent = message

    let night_css = `
      position: fixed;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%);
      background: #333;
      color: #fff;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      z-index: 99999;
      opacity: 0;
      transition: opacity 0.2s;
    `
    let light_css = `
      position: fixed;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%);
      background: #c2c2c2;
      color: #000;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      z-index: 99999;
      opacity: 0;
      transition: opacity 0.2s;
    `
    let theme_css = night_css    
    let night_mode = q("night_mode", "night_css")       
    if(night_mode == "light_css") theme_css = light_css       
    toast.style.cssText = theme_css
    
    document.body.appendChild(toast)

    requestAnimationFrame(() => {
      toast.style.opacity = '1'
      setTimeout(() => {
        toast.style.opacity = '0'
        setTimeout(() => toast.remove(), 200)
      }, 1500)
    })
  }

  window.FshowToast = function(message) {
    showToast(message)
  }
  

  /**
   * Preview how the card will look during review
   */
  let previewPopup = null

  function showCardPreview(event, elem) {
    hideCardPreview()

    const html = elem.innerHTML
    const allClozes = getAllClozes(elem)

    if (allClozes.length === 0) {
      showToast(q("q_No_clozes_found_in_field"))
      return
    }

    // Find unique cloze numbers
    const clozeNums = [...new Set(allClozes.map(c => c.number))].sort((a, b) => a - b)

    previewPopup = document.createElement('div')
    previewPopup.id = 'efdrce-preview-popup'

    let q1 = q("q_Card_Preview", `Card Preview`) 
    let q2 = q("q_Card", `Card`) 
    let night_mode = q("night_mode", "night_css")    

    let night_css = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #2a2a2a;
      color: #e0e0e0;
      padding: 20px 24px;
      border: 1px solid rgba(128,128,128,0.7);
      border-radius: 10px;
      font-size: 14px;
      z-index: 99999;
      box-shadow: 0px 0px 16px rgba(255, 255, 255, 0.2);
      max-width: 80%;
      max-height: 80%;
      overflow: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `
    let light_css = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #dcdcdc;
      color: #000000;
      padding: 20px 24px;
      border-radius: 10px;
      font-size: 14px;
      z-index: 99999;
      box-shadow: 8px 8px 8px rgba(0,0,0,0.2);
      max-width: 80%;
      max-height: 80%;
      overflow: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `

    let night_html = `
      <div style="font-size: 13px; font-weight: 500; margin-bottom: 16px; color: #fff;">
        ${q1}
      </div>
    `
    let light_html = `
      <div style="font-size: 13px; font-weight: 500; margin-bottom: 16px; color: #000;">
        ${q1}
      </div>
    `

    let previewHtml = `` 
    if( night_mode == "night_css" ) {
      previewPopup.style.cssText = night_css
      previewHtml = night_html 
    } 
    else {
      previewPopup.style.cssText = light_css
      previewHtml = light_html
    }
    
    
    // Generate preview for each cloze number
    for (const num of clozeNums) {
      const color = getClozeColor(num)
      const previewText = html.replace(/\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/g, (match, cNum, content, hint) => {
        const clozeNum = parseInt(cNum, 10)
        const temp = document.createElement('div')
        temp.innerHTML = content
        const plainContent = temp.textContent || ''

        if (clozeNum === num) {
          const displayHint = hint || '...'
          return `<span style="color: ${color}; font-weight: 500;">[${displayHint}]</span>`
        } else {
          return plainContent
        }
      })

           

      if( night_mode == "night_css" ) {
          previewHtml += `
          <div style="margin-bottom: 12px; padding: 12px; background: #000; border-radius: 6px;">
            <div style="color: ${color}; font-size: 11px; margin-bottom: 6px; font-weight: 600;">${q2} ${num}</div>
            <div style="line-height: 1.5;">${previewText}</div>
          </div>
        `
      }
      else {
          previewHtml += `
          <div style="margin-bottom: 12px; padding: 12px; background: #fff border-radius: 6px;">
            <div style="color: ${color}; font-size: 11px; margin-bottom: 6px; font-weight: 600;">${q2} ${num}</div>
            <div style="line-height: 1.5;">${previewText}</div>
          </div>
        `
      }
      
    }

    previewPopup.innerHTML = previewHtml

    document.body.appendChild(previewPopup)

    // Close on Escape or Enter - use capture and prevent propagation
    const closeHandler = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        hideCardPreview()
        document.removeEventListener('keydown', closeHandler, true)
      }
    }
    document.addEventListener('keydown', closeHandler, true)

    // Close on click outside
    setTimeout(() => {
      document.addEventListener('click', function clickOutside(e) {
        if (previewPopup && !previewPopup.contains(e.target)) {
          hideCardPreview()
          document.removeEventListener('click', clickOutside)
        }
      })
    }, 100)
  }

  function hideCardPreview() {
    if (previewPopup) {
      previewPopup.remove()
      previewPopup = null
    }
  }

  /**
   * Find and replace within clozes only
   */
  let findReplacePopup = null
  let FindRepWinKeyHandler = null
  let FindRepWinClickHandler = null
  let elem_handleBlur = null  

  function showFindReplace(event, elem) {    
    hideFindReplace()

    findReplacePopup = document.createElement('div')
    findReplacePopup.id = 'efdrce-find-replace-popup'

    let q1 = q("q_Find_Replace_in_Clozes", `Find & Replace in Clozes`)
    let q2 = q("q_Find", `Find`)
    let q3 = q("q_Replace_with", `Replace with`)
    let q4 = q("q_Close", `Cancel`)
    let q5 = q("q_Replace_All", `Replace All`)
    let night_mode = q("night_mode", "night_css")

    let night_css = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(15, 15, 15, 1);
      color: #e0e0e0;
      padding: 20px 24px;
      border: 1px solid rgba(128,128,128,0.7);
      border-radius: 10px;
      font-size: 14px;
      z-index: 99999;
      box-shadow: 0px 0px 16px rgba(255, 255, 255, 0.2);
      min-width: 320px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `

    let light_css = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #e0e0e0;
      color: #000000;
      padding: 20px 24px;
      border-radius: 10px;
      font-size: 14px;
      z-index: 99999;
      box-shadow: 8px 8px 8px rgba(0,0,0,0.2);
      min-width: 320px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `
    
    let night_html = `
      <style>
        #efdrce-cancel-btn:focus,
        #efdrce-replace-all-btn:focus {
          box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.5);
        }
        
        #efdrce-find-input:focus,
        #efdrce-replace-input:focus {
          box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.3);
        }
      </style>
      <div style="font-size: 13px; font-weight: 500; margin-bottom: 16px; color: #fff;">
        ${q1}
      </div>
      <div style="margin-bottom: 14px;">
        <input type="text" id="efdrce-find-input" style="
          width: 100%;
          padding: 10px 12px;
          border: none;
          border-radius: 6px;
          background: #3a3a3a;
          color: #fff;
          font-size: 14px;
          box-sizing: border-box;
          outline: none;
        " placeholder=" ${q2}...">
      </div>
      <div style="margin-bottom: 16px;">
        <input type="text" id="efdrce-replace-input" style="
          width: 100%;
          padding: 10px 12px;
          border: none;
          border-radius: 6px;
          background: #3a3a3a;
          color: #fff;
          font-size: 14px;
          box-sizing: border-box;
          outline: none;
        " placeholder="${q3}...">
      </div>
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button id="efdrce-cancel-btn" tabindex="0" style="
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          background: #444;
          color: #ccc;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
        ">${q4} [Esc]</button>
        <button id="efdrce-replace-all-btn" tabindex="0" style="
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          background: #324c79;
          color: #fff;
          font-weight: 500;
          cursor: pointer;
          font-size: 13px;
        ">${q5} [Enter]</button>
      </div>
      <div id="efdrce-replace-result" style="margin-top: 12px; font-size: 12px; color: #888; text-align: center;"></div>
    `
    
    
    let light_html = `
      <style>
        #efdrce-cancel-btn:focus,
        #efdrce-replace-all-btn:focus {
          box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.5);
        }
        
        #efdrce-find-input:focus,
        #efdrce-replace-input:focus {
          box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.3);
        }
      </style>
      <div style="font-size: 13px; font-weight: 500; margin-bottom: 16px; color: #000;">
        ${q1}
      </div>
      <div style="margin-bottom: 14px;">
        <input type="text" id="efdrce-find-input" style="
          width: 100%;
          padding: 10px 12px;
          border: none;
          border-radius: 6px;
          background: #FFFFFF;
          color: #000;
          font-size: 14px;
          box-sizing: border-box;
          outline: none;
        " placeholder=" ${q2}...">
      </div>
      <div style="margin-bottom: 16px;">
        <input type="text" id="efdrce-replace-input" style="
          width: 100%;
          padding: 10px 12px;
          border: none;
          border-radius: 6px;
          background: #ffffff;
          color: #000;
          font-size: 14px;
          box-sizing: border-box;
          outline: none;
        " placeholder="${q3}...">
      </div>
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button id="efdrce-cancel-btn" tabindex="0" style="
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          background: #a8a8a8;
          color: #1c1c1c;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
        ">${q4} [Esc]</button>
        <button id="efdrce-replace-all-btn" tabindex="0" style="
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          background: #77a8ff;
          color: #1c1c1c;
          font-weight: 500;
          cursor: pointer;
          font-size: 13px;
        ">${q5} [Enter]</button>
      </div>
      <div id="efdrce-replace-result" style="margin-top: 12px; font-size: 12px; color: #5f5f5f; text-align: center;"></div>
    `

    if( night_mode == "night_css" ) {
      findReplacePopup.style.cssText = night_css
      findReplacePopup.innerHTML = night_html 
    }
    else {
      findReplacePopup.style.cssText = light_css 
      findReplacePopup.innerHTML = light_html   
    }

    document.body.appendChild(findReplacePopup)

    let findInput = document.getElementById('efdrce-find-input')
    let replaceInput = document.getElementById('efdrce-replace-input')
    let replaceBtn = document.getElementById('efdrce-replace-all-btn')
    let cancelBtn = document.getElementById('efdrce-cancel-btn')
    let resultDiv = document.getElementById('efdrce-replace-result')

    const selection = window.getSelection()


    elem_handleBlur = EFDRCE.handleBlur 
    EFDRCE.handleBlur = null 

    if (!selection || selection.isCollapsed) { // No selection
      findInput.focus()
    }
    else {
      findInput.value = selection
      replaceInput.focus()
    }

    findInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.keyCode === 13) {     
        e.preventDefault()
        e.stopPropagation();
        e.stopImmediatePropagation()    
        replaceInput.focus()
      }
      if (e.key === 'Tab' && e.shiftKey){
        e.preventDefault()
        e.stopPropagation();
        e.stopImmediatePropagation() 
      }
    })

    replaceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.keyCode === 13) {     
        e.preventDefault()
        e.stopPropagation();
        e.stopImmediatePropagation()    
        replaceBtn.click();
      }
      if (e.key === 'Tab' && !e.shiftKey){
        e.preventDefault()
        e.stopPropagation();
        e.stopImmediatePropagation() 
      }
    })


    replaceBtn.addEventListener('click', () => {
      const findText = findInput.value
      const replaceText = replaceInput.value

      if (!findText) return

      const html = elem.innerHTML
      let count = 0

      const newHtml = html.replace(/(\{\{c\d+::)(.*?)((?:::.*?)?\}\})/g, (match, prefix, content, suffix) => {
        if (content.includes(findText)) {
          const newContent = content.split(findText).join(replaceText)
          count += (content.split(findText).length - 1)
          return prefix + newContent + suffix
        }
        return match
      })

      if (count > 0) {        
        elem.focus()
        setTimeout(() => {
          saveUndoState(elem)
          elem.innerHTML = newHtml
          EFDRCE.CleanAndResize(elem)          
          window.pycmd('EFDRCE#' + elem.getAttribute('data-EFDRCEnid') + '#' + elem.getAttribute('data-EFDRCEfield') + '#' + elem.innerHTML)             
          replaceInput.focus()
        }, 200)

        q1 = q("q_Replaced_occurrencs", `Replaced occurrences`)
        
        resultDiv.textContent = `${q1}: ${count}`
        if( night_mode == "night_css" ) resultDiv.style.color = '#67df6c';
        else resultDiv.style.color = '#164216';

      } else {
        q1 = q("q_No_matches_found_in_clozes", 'No matches found in clozes')         
        resultDiv.textContent = q1
        if( night_mode == "night_css" )  resultDiv.style.color = '#ff8383';
        else resultDiv.style.color = '#810e0e';
      }
    })

    cancelBtn.addEventListener('click', hideFindReplace)

    // Capture ALL keystrokes at document level so they never reach the field
    FindRepWinKeyHandler = (e) => {
      if (e.key === 'Escape') {        
        hideFindReplace()
      }      
    }

    document.addEventListener('keydown', FindRepWinKeyHandler, true)


    // Close on click outside palette
    FindRepWinClickHandler = (e) => {
      if (findReplacePopup && !findReplacePopup.contains(e.target)) {
        hideFindReplace()
      }
    }

    setTimeout(() => {
      document.addEventListener('mousedown', FindRepWinClickHandler, true)
    }, 50)


  }


  function hideFindReplace() {    
    if(FindRepWinKeyHandler) {      
      document.removeEventListener('keydown', FindRepWinKeyHandler, true)
      FindRepWinKeyHandler = null
      if(elem_handleBlur) {
        EFDRCE.handleBlur = elem_handleBlur
        elem_handleBlur = null
      }
    }

    if(FindRepWinClickHandler) {
      document.removeEventListener('mousedown', FindRepWinClickHandler, true)
      FindRepWinClickHandler = null
    }

    if (findReplacePopup) {      
      findReplacePopup.remove()
      findReplacePopup = null
    }
  }


  // ============ SMART FEATURES ============

  let suggestionsEnabled = false
  let originalFieldHtml = null
  let suggestionsFieldId = null

  /**
   * Toggle cloze candidate suggestions
   * Highlights: bold/italic text, Capitalized Words, numbers, dates
   */
  function toggleClozeSuggestions(event, elem) {
    if (suggestionsEnabled && suggestionsFieldId === elem.getAttribute('data-EFDRCEfield')) {
      // Turn off - restore original HTML
      hideSuggestions(elem)
    } else {
      // Turn on - show suggestions
      showSuggestions(elem)
    }
  }

  function showSuggestions(elem) {
    // Store original state
    suggestionsFieldId = elem.getAttribute('data-EFDRCEfield')
    originalFieldHtml = elem.innerHTML
    suggestionsEnabled = true

    // Get text content and find candidates
    const html = elem.innerHTML

    // Don't highlight inside existing clozes
    // Process the HTML to highlight candidates outside of clozes
    let result = ''
    let lastIndex = 0
    const clozeRegex = /\{\{c\d+::.*?(?:::.*?)?\}\}/g
    let match

    while ((match = clozeRegex.exec(html)) !== null) {
      // Process text before this cloze
      const beforeCloze = html.substring(lastIndex, match.index)
      result += highlightCandidates(beforeCloze)
      // Keep cloze as-is
      result += match[0]
      lastIndex = match.index + match[0].length
    }
    // Process remaining text after last cloze
    result += highlightCandidates(html.substring(lastIndex))

    elem.innerHTML = result
    EFDRCE.CleanAndResize(elem)
  }


  function hideSuggestions(elem) {
    if (originalFieldHtml !== null) {
      //elem.innerHTML = originalFieldHtml      
      // It’s better to make replacements and save what the user enters
      elem.querySelectorAll('.efdrce-suggestion').forEach(el => {
        el.replaceWith(...el.childNodes);
      });
      EFDRCE.CleanAndResize(elem)
    }
    suggestionsEnabled = false
    originalFieldHtml = null
    suggestionsFieldId = null
  }

  function highlightCandidates(text) {
    // First, highlight content inside bold/italic/underline tags
    text = text.replace(/(<(?:b|strong|i|em|u)(?:\s[^>]*)?>)(.*?)(<\/(?:b|strong|i|em|u)>)/gi, (match, openTag, content, closeTag) => {
      // Don't double-highlight if already wrapped
      if (content.includes('efdrce-suggestion')) return match
      const plainContent = content.replace(/<[^>]+>/g, '').trim()
      if (!plainContent) return match
      return `${openTag}<span class="efdrce-suggestion" style="background: rgba(255, 196, 0, 0.3); border-radius: 2px; cursor: pointer;" data-suggestion-type="formatted">${content}</span>${closeTag}`
    })

    // Then process remaining text between tags
    const tagRegex = /<[^>]+>/g
    let result = ''
    let lastIndex = 0
    let match

    while ((match = tagRegex.exec(text)) !== null) {
      // Process text before this tag
      const beforeTag = text.substring(lastIndex, match.index)
      result += highlightTextCandidates(beforeTag)
      // Keep tag as-is
      result += match[0]
      lastIndex = match.index + match[0].length
    }
    // Process remaining text
    result += highlightTextCandidates(text.substring(lastIndex))

    return result
  }

  function highlightTextCandidates(text) {
    if (!text.trim()) return text

    // Patterns to highlight (in order of priority)
    const patterns = [
      // Dates: various formats
      { regex: /\b\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\b/g, type: 'date' },
      { regex: /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,?\s+\d{4})?\b/gi, type: 'date' },
      { regex: /\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?(?:\s+\d{4})?\b/gi, type: 'date' },
      // Years
      { regex: /\b(?:19|20)\d{2}\b/g, type: 'number' },
      // Numbers with units (expanded)
      { regex: /\b\d+(?:\.\d+)?(?:\s*)?(?:%|mg|kg|ml|mL|cm|mm|m|km|g|lb|oz|hrs?|mins?|secs?|mmHg|bpm|years?|months?|weeks?|days?|times?)\b/gi, type: 'number' },
      // Decimal numbers
      { regex: /\b\d+\.\d+\b/g, type: 'number' },
      // Standalone numbers (2+ digits)
      { regex: /\b\d{2,}\b/g, type: 'number' },
      // Acronyms (2+ caps)
      { regex: /\b[A-Z]{2,}\b/g, type: 'acronym' },
      // Capitalized phrases (2+ words)
      { regex: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g, type: 'term' },
      // Single capitalized words (3+ chars, not common words)
      { regex: /\b[A-Z][a-z]{2,}\b/g, type: 'term' },
      // Words with mixed case (like iPhone, macOS)
      { regex: /\b[a-z]+[A-Z][a-zA-Z]*\b/g, type: 'term' },
      // Hyphenated terms
      { regex: /\b[A-Za-z]+-[A-Za-z]+(?:-[A-Za-z]+)*\b/g, type: 'term' },
    ]

    // Track positions to highlight
    const highlights = []

    for (const pattern of patterns) {
      let m
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags)
      while ((m = regex.exec(text)) !== null) {
        // Check if this position overlaps with existing highlight
        const start = m.index
        const end = start + m[0].length
        const overlaps = highlights.some(h =>
          (start >= h.start && start < h.end) || (end > h.start && end <= h.end)
        )
        if (!overlaps) {
          highlights.push({ start, end, text: m[0], type: pattern.type })
        }
      }
    }

    // Sort by position
    highlights.sort((a, b) => a.start - b.start)

    // Build result with highlights
    let result = ''
    let pos = 0
    for (const h of highlights) {
      result += text.substring(pos, h.start)
      result += `<span class="efdrce-suggestion" style="background: rgba(255, 215, 0, 0.3); border-radius: 2px; cursor: pointer;" data-suggestion-type="${h.type}">${h.text}</span>`
      pos = h.end
    }
    result += text.substring(pos)

    return result
  }

  function showSuggestionsToast(message) {
    const existing = document.getElementById('efdrce-suggestions-toast')
    if (existing) existing.remove()

    const toast = document.createElement('div')
    toast.id = 'efdrce-suggestions-toast'
    toast.textContent = message

    let night_css = `
      position: fixed;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%);
      background: #333;
      color: #fff;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      z-index: 99999;
      opacity: 0;
      transition: opacity 0.2s;
    `
    let light_css = `
      position: fixed;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%);
      background: #d6d6d6;
      color: #000;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      z-index: 99999;
      opacity: 0;
      transition: opacity 0.2s;
    `
    let theme_css = night_css   

    qb = EFDRCE.CONF?.q || {};
    if(Object.keys(qb).length > 0) {      
      if(qb.night_mode == "light_css") theme_css = light_css   
    }
    toast.style.cssText = theme_css

    document.body.appendChild(toast)

    requestAnimationFrame(() => {
      toast.style.opacity = '1'
      setTimeout(() => {
        toast.style.opacity = '0'
        setTimeout(() => toast.remove(), 200)
      }, 2000)
    })
  }

  // ============ COMMAND PALETTE ============
  //
  // Focus NEVER leaves the editable field. All typing is captured via a
  // document-level keydown listener (capture phase) so the field's blur
  // handler never fires and the editing session stays open.

  let commandPalettePopup = null
  let commandPaletteField = null
  let commandPaletteFilter = ''
  let selectedCommandIndex = 0
  let paletteKeyHandler = null
  let paletteClickHandler = null
  let savedSelectionRange = null

  function getCommands() {
    const shortcuts = EFDRCE.CONF?.cloze_tools?.shortcuts || {}
    const nameshortcuts = EFDRCE.CONF?.cloze_tools?.nameshortcuts || {}
    return [
      { name: 'Remove Cloze', desc: nameshortcuts.remove_single, shortcut: shortcuts.remove_single, action: removeClozeAtCursorOrSelection },
      { name: 'Remove All Clozes', desc: nameshortcuts.remove_all, shortcut: shortcuts.remove_all, action: removeAllClozesInField },
      { name: 'Remove Same Number', desc: nameshortcuts.remove_same_number, shortcut: shortcuts.remove_same_number, action: removeClozesOfSameNumber },
      { name: 'Increment Number', desc: nameshortcuts.increment, shortcut: shortcuts.increment, action: incrementClozeNumber },
      { name: 'Decrement Number', desc: nameshortcuts.decrement, shortcut: shortcuts.decrement, action: decrementClozeNumber },
      { name: 'Renumber Cloze', desc: nameshortcuts.renumber, shortcut: shortcuts.renumber, action: startRenumberSequence },
      { name: 'Add Hint', desc: nameshortcuts.add_hint, shortcut: shortcuts.add_hint, action: addHint },
      { name: 'Remove Hint', desc: nameshortcuts.remove_hint, shortcut: shortcuts.remove_hint, action: removeHint },
      { name: 'Word Count Hint', desc: nameshortcuts.word_count_hint, shortcut: shortcuts.word_count_hint, action: addWordCountHint },
      { name: 'Hint from Selection', desc: nameshortcuts.hint_from_selection, shortcut: shortcuts.hint_from_selection, action: hintFromSelection },
      { name: 'Split Cloze', desc: nameshortcuts.split_cloze, shortcut: shortcuts.split_cloze, action: splitCloze },
      { name: 'Merge Clozes', desc: nameshortcuts.merge_clozes, shortcut: shortcuts.merge_clozes, action: mergeClozes },
      { name: 'Move Out of Cloze', desc: nameshortcuts.move_out_of_cloze, shortcut: shortcuts.move_out_of_cloze, action: moveOutOfCloze },
      { name: 'Move Into Cloze', desc: nameshortcuts.move_into_cloze, shortcut: shortcuts.move_into_cloze, action: moveIntoCloze },
      { name: 'Image to Cloze', desc: nameshortcuts.image_to_cloze, shortcut: shortcuts.image_to_cloze, action: imageToCloze },
      { name: 'Jump to Previous Cloze', desc: nameshortcuts.jump_prev_cloze, shortcut: shortcuts.jump_prev_cloze, action: jumpToPrevCloze },
      { name: 'Jump to Next Cloze', desc: nameshortcuts.jump_next_cloze, shortcut: shortcuts.jump_next_cloze, action: jumpToNextCloze },      
      { name: 'Jump to Beginning Cloze', desc: nameshortcuts.jump_to_beginning_cloze, shortcut: shortcuts.jump_to_beginning_cloze, action: jumpToBegCloze },
      { name: 'Jump to End Cloze', desc: nameshortcuts.jump_to_end_cloze, shortcut: shortcuts.jump_to_end_cloze, action: jumpToEndCloze },
      { name: 'Jump to Beginning', desc: nameshortcuts.jump_to_beginning, shortcut: shortcuts.jump_to_beginning, action: jumpToBeginning },
      { name: 'Jump to End', desc: nameshortcuts.jump_to_end, shortcut: shortcuts.jump_to_end, action: jumpToEnd },
      { name: 'Toggle Overlay', desc: nameshortcuts.toggle_overlay, shortcut: shortcuts.toggle_overlay, action: toggleClozeOverlay },            
      { name: 'Copy Cloze Content', desc: nameshortcuts.copy_cloze_content, shortcut: shortcuts.copy_cloze_content, action: copyClozeContent },
      { name: 'Preview Card', desc: nameshortcuts.preview_card, shortcut: shortcuts.preview_card, action: showCardPreview },
      { name: 'Find & Replace', desc: nameshortcuts.find_replace, shortcut: shortcuts.find_replace, action: showFindReplace },
      { name: 'Suggest Clozes', desc: nameshortcuts.suggest_clozes, shortcut: shortcuts.suggest_clozes, action: toggleClozeSuggestions },
      { name: 'Replay Question', desc: nameshortcuts.replay_question, shortcut: shortcuts.replay_question, action: replayQuestion },
    ]
  }

  function getFilteredCommands() {
    const commands = getCommands()
    const f = commandPaletteFilter.toLowerCase()
    if (!f) return commands
    return commands.filter(cmd =>
      cmd.name.toLowerCase().includes(f) ||
      cmd.desc.toLowerCase().includes(f)
    )
  }

  function renderPalette() {
    if (!commandPalettePopup) return
    const searchDisplay = commandPalettePopup.querySelector('#efdrce-palette-search-display')
    const resultsDiv = commandPalettePopup.querySelector('#efdrce-palette-results')
    if (!searchDisplay || !resultsDiv) return

    let night_mode = q("night_mode", "night_css")
    
    // Update search display
    if (commandPaletteFilter) {
      searchDisplay.textContent = commandPaletteFilter
      if( night_mode == "night_css" ) searchDisplay.style.color = '#fff';
      else searchDisplay.style.color = '#000'; 
    }
    else {      
      let q1 = q("q_Type_to_search_commands", "Type to search commands")
      searchDisplay.textContent = `${q1}...`
      if( night_mode == "night_css" ) searchDisplay.style.color = '#888';
      else searchDisplay.style.color = '#3c3c3c';
    }

    const filtered = getFilteredCommands()
    if (selectedCommandIndex >= filtered.length) {
      selectedCommandIndex = Math.max(0, filtered.length - 1)
    }
    
    if( night_mode == "night_css" ) {      
      resultsDiv.innerHTML = filtered.map((cmd, i) => `
        <div class="efdrce-palette-item" data-index="${i}" style="
          padding: 10px 16px;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          text-align: left;
          background: ${i === selectedCommandIndex ? '#3a3a3a' : 'transparent'};
        ">
          <div style="flex: 1; text-align: left;">
            <div style="font-weight: 500; color: #fff; text-align: left;">${cmd.name}</div>
            <div style="font-size: 12px; color: #c1b8b8; margin-top: 2px; text-align: left;">${cmd.desc}</div>
          </div>
          ${cmd.shortcut ? `<div style="font-size: 11px; color: #b7b7b7; background: #333; padding: 3px 8px; border-radius: 4px; white-space: nowrap; margin-left: 12px;">${cmd.shortcut}</div>` : ''}
        </div>
      `).join('')
    }
    else {
      resultsDiv.innerHTML = filtered.map((cmd, i) => `
        <div class="efdrce-palette-item" data-index="${i}" style="
          padding: 10px 16px;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          text-align: left;
          background: ${i === selectedCommandIndex ? '#b0b0b0' : 'transparent'};
        ">
          <div style="flex: 1; text-align: left;">
            <div style="font-weight: 500; color: #000; text-align: left;">${cmd.name}</div>
            <div style="font-size: 12px; color: #1d1d1d; margin-top: 2px; text-align: left;">${cmd.desc}</div>
          </div>
          ${cmd.shortcut ? `<div style="font-size: 11px; color: #b7b7b7; background: #333; padding: 3px 8px; border-radius: 4px; white-space: nowrap; margin-left: 12px;">${cmd.shortcut}</div>` : ''}
        </div>
      `).join('')
    }


    // Click handlers — use mousedown to prevent field blur
    resultsDiv.querySelectorAll('.efdrce-palette-item').forEach((item, idx) => {
      item.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        executeCommand(filtered[idx])
      })
      
      // rgba(15, 15, 15, 1); colorB
      // #e0e0e0; colorB
      let colorK = '#304146' 
      let colorB = '#151515';
      if( night_mode != "night_css" ) {
        colorK = '#91a4b7' 
        colorB = '#d4d4d4'; 
      }
      item.addEventListener('mouseenter', () => {
        let selComIdx = selectedCommandIndex;         
        const items = resultsDiv.querySelectorAll('.efdrce-palette-item')
        items.forEach((el, j) => {  
          if(j === selComIdx) el.style.background = colorK;
          else el.style.background = j === idx ? colorB : 'transparent'
        })
      })
    })

    // Scroll selected into view
    const selected = resultsDiv.querySelectorAll('.efdrce-palette-item')[selectedCommandIndex]
    if (selected) selected.scrollIntoView({ block: 'nearest' })   
  }

  function executeCommand(cmd) {
    const field = commandPaletteField
    const range = savedSelectionRange
    hideCommandPalette()
    if (field && cmd && cmd.action) {
      // Restore the original selection before running the command
      if (range) {
        const sel = window.getSelection()
        if (sel) {
          sel.removeAllRanges()
          sel.addRange(range)
        }
      }
      saveUndoState(field)
      cmd.action(null, field)
    }
  }

  function showCommandPalette(event, elem) {
    if (commandPalettePopup) {
      hideCommandPalette()
      return
    }

    commandPaletteField = elem
    commandPaletteFilter = ''
    // selectedCommandIndex = 0

    // Save current selection — focus stays in the field the entire time
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      savedSelectionRange = sel.getRangeAt(0).cloneRange()
    } else {
      savedSelectionRange = null
    }

    commandPalettePopup = document.createElement('div')
    commandPalettePopup.id = 'efdrce-command-palette'

    
    let q1 = q("q_Type_to_search_commands", "Type to search commands")
    let night_mode = q("night_mode", "night_css")

    let night_css = `
      position: fixed;
      top: 20%;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 15, 15, 1);
      color: #e0e0e0;
      border: 1px solid rgba(128,128,128,0.7);
      border-radius: 10px;
      font-size: 14px;
      z-index: 99999;
      box-shadow: 0px 0px 16px rgba(255, 255, 255, 0.2);
      width: 400px;
      max-height: 60vh;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `
    let light_css = `
      position: fixed;
      top: 20%;
      left: 50%;
      transform: translateX(-50%);
      background: #e0e0e0;
      color: rgba(15, 15, 15, 1);
      border-radius: 10px;
      font-size: 14px;
      z-index: 99999;
      box-shadow: 8px 8px 8px rgba(0,0,0,0.2);
      width: 400px;
      max-height: 60vh;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `
    
    let night_html = `
      <div style="padding: 12px;">
        <div id="efdrce-palette-search-display" style="
          width: 100%;
          padding: 10px 12px;
          border: none;
          border-radius: 6px;
          background: #3a3a3a;
          color: #888;
          font-size: 14px;
          box-sizing: border-box;
          min-height: 38px;
          text-align: left;
        ">${q1}...</div>
      </div>
      <div id="efdrce-palette-results" style="
        max-height: calc(60vh - 60px);
        overflow-y: auto;
        padding-bottom: 8px;
      "></div>
    `

    let light_html = `
      <div style="padding: 12px;">
        <div id="efdrce-palette-search-display" style="
          width: 100%;
          padding: 10px 12px;
          border: none;
          border-radius: 6px;
          background: #ebebeb;
          color: #353535;
          font-size: 14px;
          box-sizing: border-box;
          min-height: 38px;
          text-align: left;
        ">${q1}...</div>
      </div>
      <div id="efdrce-palette-results" style="
        max-height: calc(60vh - 60px);
        overflow-y: auto;
        padding-bottom: 8px;
      "></div>
    `
    
    if( night_mode == "night_css") {
      commandPalettePopup.style.cssText = night_css  
      commandPalettePopup.innerHTML = night_html
    }
    else {
      commandPalettePopup.style.cssText = light_css  
      commandPalettePopup.innerHTML = light_html
    }

    

    // Prevent any clicks on the palette from stealing field focus
    commandPalettePopup.addEventListener('mousedown', (e) => {
      e.preventDefault()
    })

    document.body.appendChild(commandPalettePopup)
    renderPalette()

    // Capture ALL keystrokes at document level so they never reach the field
    paletteKeyHandler = (e) => {
      // Always prevent the keystroke from reaching the editable field
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      
      if (e.key === 'Escape') {
        hideCommandPalette()
        return
      }

      if (e.key === 'Enter') {
        const filtered = getFilteredCommands()
        if (filtered.length > 0 && selectedCommandIndex < filtered.length) {
          executeCommand(filtered[selectedCommandIndex])
        }
        return
      }

      if (e.key === 'ArrowDown') {
        const filtered = getFilteredCommands()
        if(selectedCommandIndex == (filtered.length - 1) ){
          selectedCommandIndex = 0
        }
        else { 
          selectedCommandIndex = Math.min(selectedCommandIndex + 1, filtered.length - 1)        
        }
        
        renderPalette()
        return
      }

      if (e.key === 'ArrowUp') {
        const filtered = getFilteredCommands()
        if(selectedCommandIndex == 0){
          selectedCommandIndex = filtered.length - 1
        }
        else {
          selectedCommandIndex = Math.max(selectedCommandIndex - 1, 0)          
        }                
        renderPalette()
        return
      }

      if (e.key === 'Backspace') {
        if (commandPaletteFilter.length > 0) {
          commandPaletteFilter = commandPaletteFilter.slice(0, -1)
          selectedCommandIndex = 0
          renderPalette()
        }
        return
      }

      // Printable character — append to filter
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        commandPaletteFilter += e.key
        selectedCommandIndex = 0
        renderPalette()
      }
    }
    document.addEventListener('keydown', paletteKeyHandler, true)

    // Close on click outside palette
    paletteClickHandler = (e) => {
      if (commandPalettePopup && !commandPalettePopup.contains(e.target)) {
        hideCommandPalette()
      }
    }
    setTimeout(() => {
      document.addEventListener('mousedown', paletteClickHandler, true)
    }, 50)
  }

  function hideCommandPalette() {
    if (paletteKeyHandler) {
      document.removeEventListener('keydown', paletteKeyHandler, true)
      paletteKeyHandler = null
    }
    if (paletteClickHandler) {
      document.removeEventListener('mousedown', paletteClickHandler, true)
      paletteClickHandler = null
    }
    if (commandPalettePopup) {
      commandPalettePopup.remove()
      commandPalettePopup = null
    }
    commandPaletteField = null
    savedSelectionRange = null
    commandPaletteFilter = ''
  }

  // ============ CARD NAVIGATION ============

  /**
   * Replay the question (show front of card) without undoing edits
   */
  function replayQuestion(event, elem) {
    // Just show the question directly - edits are saved on blur automatically
    pycmd('EFDRCE!showQuestion')
  }

  // ============ HINT FUNCTIONS ============

  /**
   * Set or update hint for cloze at cursor
   * @param {HTMLElement} elem - The editable field element
   * @param {Object} cloze - The cloze object
   * @param {string} hint - The new hint text
   */
  function setClozeHint(elem, cloze, hint) {
    const newCloze = hint
      ? `{{c${cloze.number}::${cloze.content}::${hint}}}`
      : `{{c${cloze.number}::${cloze.content}}}`

    const html = elem.innerHTML
    const before = html.substring(0, cloze.htmlStart)
    const after = html.substring(cloze.htmlEnd)
    elem.innerHTML = before + newCloze + after
    EFDRCE.CleanAndResize(elem)

    placeCursorAtOffset(elem, cloze.textStart)
    return true
  }

  /**
   * Remove hint from cloze at cursor
   */
  function removeHint(event, elem) {
    const cloze = getClozeAtCursor(elem)
    if (!cloze) return

    if (cloze.hint) {
      setClozeHint(elem, cloze, null)
    }
  }

  /**
   * Add word count hint to cloze at cursor
   * e.g., "2 words" or "1 word"
   */
  function addWordCountHint(event, elem) {
    const cloze = getClozeAtCursor(elem)
    if (!cloze) return

    // Strip HTML tags to count words in plain text
    const temp = document.createElement('div')
    temp.innerHTML = cloze.content
    const plainText = temp.textContent || ''

    // Count words (split by whitespace, filter empty)
    const words = plainText.trim().split(/\s+/).filter(w => w.length > 0)
    const count = words.length
    let q1 = q("q_word", `word`)
    let q2 = q("q_words", `words`)    
    const hint = count === 1 ? `1 ${q1}` : `${count} ${q2}`

    setClozeHint(elem, cloze, hint)
  }

  // State for hint preview
  let hintPreviewElem = null
  let hintPreviewClozeIndex = null
  let hintPreviewClozeNumber = null
  let hintPreviewFieldId = null
  let hintPreviewOriginalHtml = null

  /**
   * Strip HTML tags from content
   */
  function stripHtml(html) {
    const temp = document.createElement('div')
    temp.innerHTML = html
    return temp.textContent || ''
  }

  /**
   * Show floating hint preview centered on screen
   */
  function showHintPreview(elem, cloze, clozeIndex) {
    hideHintPreview()

    hintPreviewFieldId = elem.getAttribute('data-EFDRCEfield')
    hintPreviewClozeIndex = clozeIndex
    hintPreviewOriginalHtml = elem.innerHTML
    hintPreviewClozeNumber = cloze.number

    hintPreviewElem = document.createElement('div')
    hintPreviewElem.id = 'efdrce-hint-preview-float'
    
    let q1 = q("q_Card_Preview", `Card Preview`)
    let q2 = q("q_to_close", `to close`)
    let night_mode = q("night_mode", "night_css")    

    let night_html = `
      <div style="
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
        color: #fff;
        padding: 16px 24px;
        border: 1px solid rgba(128,128,128,0.7);
        border-radius: 12px;
        font-size: 14px;
        box-shadow: 0px 0px 16px rgba(255, 255, 255, 0.2);
        max-width: 600px;
        min-width: 300px;
        z-index: 99999;       
      ">
        <div style="color: #b6b6b6; font-size: 11px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">${q1} (c${cloze.number}) - Esc ${q2}</div>
        <div id="efdrce-hint-preview-content" style="
          font-size: 14px;
          line-height: 1.5;
          word-break: break-word;
        "></div>
      </div>
    `

    let light_html = `
      <div style="
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #e2e2e2 0%, #ffffff 100%);
        color: #000;
        padding: 16px 24px;
        border-radius: 12px;
        font-size: 14px;
        box-shadow: 8px 8px 8px rgba(0,0,0,0.2);
        max-width: 600px;
        min-width: 300px;
        z-index: 99999;
        border: 1px solid rgba(128,128,128,0.7);
      ">
        <div style="color: #000000; font-size: 11px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">${q1} (c${cloze.number}) - Esc ${q2}</div>
        <div id="efdrce-hint-preview-content" style="
          font-size: 14px;
          line-height: 1.5;
          word-break: break-word;
        "></div>
      </div>
    `

    if( night_mode == "night_css" ) {
      hintPreviewElem.innerHTML = night_html 
    }
    else {
      hintPreviewElem.innerHTML = light_html      
    }
    


    document.body.appendChild(hintPreviewElem)

    // Initial preview update
    updateFloatingHintPreview(elem)

    // Listen for typing to update preview
    elem.addEventListener('input', handleHintTyping)
    elem.addEventListener('keydown', handleHintKeydown)
  }

  function hideHintPreview() {
    if (hintPreviewElem) {
      // Remove listeners from field
      const elem = document.querySelector(`[data-EFDRCEfield="${hintPreviewFieldId}"]`)
      if (elem) {
        elem.removeEventListener('input', handleHintTyping)
        elem.removeEventListener('keydown', handleHintKeydown)
      }

      hintPreviewElem.remove()
      hintPreviewElem = null
    }
    hintPreviewClozeIndex = null
    hintPreviewClozeNumber = null
    hintPreviewFieldId = null
    hintPreviewOriginalHtml = null
  }

  function handleHintTyping() {
    const elem = document.querySelector(`[data-EFDRCEfield="${hintPreviewFieldId}"]`)
    if (elem) {
      updateFloatingHintPreview(elem)
    }
  }

  function handleHintKeydown(event) {
    if (event.key === 'Escape') {
      hideHintPreview()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      // Get current field and find the cloze to position cursor after it
      const elem = document.querySelector(`[data-EFDRCEfield="${hintPreviewFieldId}"]`)
      if (elem) {
        const allClozes = getAllClozes(elem)
        const cloze = allClozes[hintPreviewClozeIndex]
        if (cloze) {
          // Calculate text position after the cloze
          const html = elem.innerHTML
          const htmlBefore = html.substring(0, cloze.index)
          const temp = document.createElement('div')
          temp.innerHTML = htmlBefore
          const textBefore = temp.textContent.length

          // Get text length of the full cloze
          const clozeTemp = document.createElement('div')
          clozeTemp.innerHTML = cloze.match
          const clozeTextLen = clozeTemp.textContent.length

          // Position cursor right after the cloze
          placeCursorAtOffset(elem, textBefore + clozeTextLen)
        }
      }
      hideHintPreview()
    }
  }

  function updateFloatingHintPreview(elem) {
    const preview = document.getElementById('efdrce-hint-preview-content')
    if (!preview) return

    const html = elem.innerHTML

    // Get current cloze - try index first, then fallback to finding by number
    const allClozes = getAllClozes(elem)
    let currentCloze = allClozes[hintPreviewClozeIndex] // const currentCloze = allClozes[hintPreviewClozeIndex]

    // Fallback: find by cloze number if index lookup failed
    if (!currentCloze && hintPreviewClozeNumber !== null) {
      currentCloze = allClozes.find(c => c.number === hintPreviewClozeNumber)
    }

    if (!currentCloze) {
      // Still no cloze found - field might have no clozes anymore
      hideHintPreview()
      return
    }

    // Track which occurrence we're on
    let occurrenceCount = 0

    // Replace all clozes for preview - hide ALL clozes with same number (like real card)
    const regex = /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/g
    const previewText = html.replace(regex, (match, num, content, hint) => {
      const clozeNum = parseInt(num, 10)
      const plainContent = stripHtml(content)
      const currentIndex = occurrenceCount
      occurrenceCount++

      if (clozeNum === hintPreviewClozeNumber) {
        // ALL clozes with this number should be hidden (like real card review)
        const displayHint = hint || '...'
        return `<span style="color: #4fc3f7; font-weight: 500;">[${displayHint}]</span>`
      } else {
        // Other numbered clozes - show content normally
        return plainContent
      }
    })

    preview.innerHTML = previewText
  }

  /**
   * Use selected text as hint for the cloze
   * Select "App" in {{c1::Apple}} → {{c1::Apple::App}}
   */
  function hintFromSelection(event, elem) {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return // No selection

    const selectedText = selection.toString().trim()
    if (!selectedText) return

    const cloze = getClozeAtCursor(elem)
    if (!cloze) return

    // Set the selected text as the hint
    setClozeHint(elem, cloze, selectedText)
  }

  /**
   * Add hint to cloze - inserts :: and positions cursor, shows preview
   */
  function addHint(event, elem) {
    const cloze = getClozeAtCursor(elem)
    if (!cloze) {
      showToast(q("q_Place_cursor_inside_a_cloze"))
      return
    }
    
    // Find cloze index - use array position, not HTML index comparison
    const allClozes = getAllClozes(elem)
    let clozeIndex = -1
    for (let i = 0; i < allClozes.length; i++) {
      if (allClozes[i].index === cloze.index) {
        clozeIndex = i
        break
      }
    }
    if (clozeIndex === -1) {
      // Fallback: find by number and content match
      clozeIndex = allClozes.findIndex(c => c.number === cloze.number && c.content === cloze.content)
    }
    if (clozeIndex === -1) clozeIndex = 0 // Last resort fallback

    const html = elem.innerHTML

    // Build new cloze with :: at end (or keep existing hint)
    const newCloze = cloze.hint
      ? `{{c${cloze.number}::${cloze.content}::${cloze.hint}}}`
      : `{{c${cloze.number}::${cloze.content}::}}`

    // Replace only this cloze
    const before = html.substring(0, cloze.htmlStart)
    const after = html.substring(cloze.htmlEnd)
    elem.innerHTML = before + newCloze + after
    EFDRCE.CleanAndResize(elem)

    // Position cursor right before the closing }}
    // The cursor should be after :: (where hint goes)
    const hintStartPos = cloze.textStart + `{{c${cloze.number}::`.length + stripHtml(cloze.content).length + '::'.length
    const hintEndPos = hintStartPos + (cloze.hint ? cloze.hint.length : 0)

    // Place cursor at hint position and ensure focus
    placeCursorAtOffset(elem, hintEndPos)
    elem.focus()

    // Show floating preview
    showHintPreview(elem, cloze, clozeIndex)
  }

  /**
   * Register cloze tool shortcuts from config
   */
  EFDRCE.setupClozeTools = function () {
    // Initialize overlay state from config
    clozeOverlayEnabled = EFDRCE.CONF?.cloze_tools?.auto_show_overlay || false
    clozeOverlayHTMLEnabled = EFDRCE.CONF?.cloze_tools?.show_HTML_in_overlay || false
    const shortcuts = EFDRCE.CONF.cloze_tools?.shortcuts
    if (!shortcuts) return

    // Wrap modifying functions so undo state is saved automatically
    function withUndo(fn) {
      return function (event, elem) {
        saveUndoState(elem)
        fn(event, elem)
      }
    }

    if (shortcuts.remove_single) {
      EFDRCE.registerShortcut(shortcuts.remove_single, withUndo(removeClozeAtCursorOrSelection))
    }

    if (shortcuts.remove_all) {
      EFDRCE.registerShortcut(shortcuts.remove_all, withUndo(removeAllClozesInField))
    }

    if (shortcuts.remove_same_number) {
      EFDRCE.registerShortcut(shortcuts.remove_same_number, withUndo(removeClozesOfSameNumber))
    }

    // Numbering shortcuts
    if (shortcuts.increment) {
      EFDRCE.registerShortcut(shortcuts.increment, withUndo(incrementClozeNumber))
    }

    if (shortcuts.decrement) {
      EFDRCE.registerShortcut(shortcuts.decrement, withUndo(decrementClozeNumber))
    }

    if (shortcuts.renumber) {
      EFDRCE.registerShortcut(shortcuts.renumber, withUndo(startRenumberSequence))
    }

    // Hint shortcuts
    if (shortcuts.add_hint) {
      EFDRCE.registerShortcut(shortcuts.add_hint, withUndo(addHint))
    }

    if (shortcuts.remove_hint) {
      EFDRCE.registerShortcut(shortcuts.remove_hint, withUndo(removeHint))
    }

    if (shortcuts.word_count_hint) {
      EFDRCE.registerShortcut(shortcuts.word_count_hint, withUndo(addWordCountHint))
    }

    if (shortcuts.hint_from_selection) {
      EFDRCE.registerShortcut(shortcuts.hint_from_selection, withUndo(hintFromSelection))
    }

    // Card navigation - register both on field and globally
    if (shortcuts.replay_question) {
      EFDRCE.registerShortcut(shortcuts.replay_question, replayQuestion)
      setupGlobalReplayShortcut(shortcuts.replay_question)
    }

    // Structure shortcuts
    if (shortcuts.split_cloze) {
      EFDRCE.registerShortcut(shortcuts.split_cloze, withUndo(splitCloze))
    }

    if (shortcuts.merge_clozes) {
      EFDRCE.registerShortcut(shortcuts.merge_clozes, withUndo(mergeClozes))
    }

    if (shortcuts.move_out_of_cloze) {
      EFDRCE.registerShortcut(shortcuts.move_out_of_cloze, withUndo(moveOutOfCloze))
    }

    if (shortcuts.move_into_cloze) {
      EFDRCE.registerShortcut(shortcuts.move_into_cloze, moveIntoCloze)
    }

    if (shortcuts.image_to_cloze) {
      EFDRCE.registerShortcut(shortcuts.image_to_cloze, withUndo(imageToCloze))
    }

    // Navigation shortcuts
    if (shortcuts.jump_prev_cloze) {
      EFDRCE.registerShortcut(shortcuts.jump_prev_cloze, jumpToPrevCloze)
    }

    if (shortcuts.jump_next_cloze) {
      EFDRCE.registerShortcut(shortcuts.jump_next_cloze, jumpToNextCloze)
    }

    if (shortcuts.jump_to_beginning_cloze) {
      EFDRCE.registerShortcut(shortcuts.jump_to_beginning_cloze, jumpToBegCloze)
    }

    if (shortcuts.jump_to_end_cloze) {
      EFDRCE.registerShortcut(shortcuts.jump_to_end_cloze, jumpToEndCloze)
    }
    
    if (shortcuts.jump_to_beginning) {
      EFDRCE.registerShortcut(shortcuts.jump_to_beginning, jumpToBeginning)
    }

    if (shortcuts.jump_to_end) {
      EFDRCE.registerShortcut(shortcuts.jump_to_end, jumpToEnd)
    }

    // Visual features
    if (shortcuts.toggle_overlay) {
      EFDRCE.registerShortcut(shortcuts.toggle_overlay, toggleClozeOverlay)
    }

    // Advanced editing
    if (shortcuts.copy_cloze_content) {
      EFDRCE.registerShortcut(shortcuts.copy_cloze_content, copyClozeContent)
    }

    if (shortcuts.preview_card) {
      EFDRCE.registerShortcut(shortcuts.preview_card, showCardPreview)
    }

    if (shortcuts.find_replace) {
      EFDRCE.registerShortcut(shortcuts.find_replace, withUndo(showFindReplace))
    }

    // Smart features
    if (shortcuts.suggest_clozes) {
      EFDRCE.registerShortcut(shortcuts.suggest_clozes, withUndo(toggleClozeSuggestions))
    }

    // UI
    if (shortcuts.command_palette) {
      EFDRCE.registerShortcut(shortcuts.command_palette, showCommandPalette)
      setupGlobalCommandPalette(shortcuts.command_palette)
    }
    
  }

  // Hook into field focus/blur for visual features
  const originalHandleFocus = EFDRCE.handleFocus
  EFDRCE.handleFocus = function(event, target) {
    originalHandleFocus(event, target)
    setupVisualFeatures(target)
  }

  const originalHandleBlur = EFDRCE.handleBlur
  EFDRCE.handleBlur = function(event, target) {
    cleanupVisualFeatures(target)
    originalHandleBlur(event, target)
  }

  /**
   * Parse shortcut string into scutInfo object (same format as EFDRCE.shortcuts)
   */
  function parseShortcut(shortcut) {    
    const specialCharCodes = {
      '-': 'minus',
      '=': 'equal',
      '[': 'bracketleft',
      ']': 'bracketright',
      ';': 'semicolon',
      "'": 'quote',
      '`': 'backquote',
      '\\': 'backslash',
      ',': 'comma',
      '.': 'period',
      '/': 'slash'
    }
    const shortcutKeys = shortcut.toLowerCase().split(/[+]/).map(key => key.trim())
    const scutInfo = {
      ctrl: shortcutKeys.includes('ctrl'),
      shift: shortcutKeys.includes('shift'),
      alt: shortcutKeys.includes('alt')
    }
    let mainKey = shortcutKeys[shortcutKeys.length - 1]
    if (mainKey.length === 1) {
      if (/\d/.test(mainKey)) {
        mainKey = 'digit' + mainKey
      } else if (/[a-zA-Z]/.test(mainKey)) {
        mainKey = 'key' + mainKey
      } else {
        const code = specialCharCodes[mainKey]
        if (code) {
          mainKey = code
        }
      }
    }
    scutInfo.key = mainKey
    return scutInfo
  }

  /**
   * Check if event matches shortcut info
   */
  function matchShortcut(event, scutInfo) {
    if (scutInfo.key !== event.code.toLowerCase()) return false
    if (scutInfo.ctrl !== (event.ctrlKey || event.metaKey)) return false
    if (scutInfo.shift !== event.shiftKey) return false
    if (scutInfo.alt !== event.altKey) return false
    return true
  }

  /**
   * Setup global keyboard listener for replay question
   */
  function setupGlobalReplayShortcut(shortcutStr) {
    const scutInfo = parseShortcut(shortcutStr)

    document.addEventListener('keydown', (event) => {
      if (matchShortcut(event, scutInfo)) {
        event.preventDefault()
        event.stopPropagation()
        replayQuestion(event, null)
      }
    }, true)
  }

  function setupGlobalCommandPalette(shortcutStr) {
    document.addEventListener('keydown', (event) => {
      // Check for Ctrl+. (or Cmd+. on Mac)
      const isCtrlOrCmd = event.ctrlKey || event.metaKey
      const isPeriod = event.key === '.' || event.code === 'Period'

      if (isCtrlOrCmd && isPeriod && !event.shiftKey && !event.altKey) {
        event.preventDefault()
        event.stopPropagation()
        // Find an editable field to use
        const field = document.querySelector('[data-EFDRCEfield][contenteditable="true"]:focus') ||
                      document.querySelector('[data-EFDRCEfield]')
        if (field) {
          showCommandPalette(event, field)
        }
      }
    }, true)
  }

  // Listen for number keys during renumber sequence
  document.addEventListener('keydown', (event) => {
    if (renumberPending) {
      handleRenumberKey(event)
    }
  }, true)
 

  // Expose helper functions for potential future use
  EFDRCE.clozeTools = {
    getClozeAtCursor,
    getAllClozes,
    stripClozeMarkup,
    removeClozeAtCursorOrSelection,
    removeAllClozesInField,
    removeClozesOfSameNumber,
    changeClozeNumber,
    incrementClozeNumber,
    decrementClozeNumber,
    startRenumberSequence,
    setClozeHint,
    addHint,
    removeHint,
    addWordCountHint,
    showHintPreview,
    hideHintPreview,
    replayQuestion,
    hintFromSelection,
    splitCloze,
    mergeClozes,
    moveOutOfCloze,
    moveIntoCloze,
    imageToCloze,
    jumpToPrevCloze,
    jumpToNextCloze,
    jumpToBegCloze,
    jumpToEndCloze,
    jumpToBeginning,
    jumpToEnd,
    toggleClozeOverlay,
    showClozeOverlay,
    hideClozeOverlay,
    getClozeColor,
    copyClozeContent,
    showCardPreview,
    hideCardPreview,
    showFindReplace,
    hideFindReplace,
    toggleClozeSuggestions,
    showSuggestions,
    hideSuggestions,
    showCommandPalette,
    hideCommandPalette
  }
})()
