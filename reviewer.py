import base64
import json
from typing import Any, Optional, Tuple, Union

import anki
from anki.template import TemplateRenderContext
from anki.notes import Note
from anki.cards import Card
from anki.collection import OpChanges
import aqt
from aqt import mw, gui_hooks
from aqt.editor import Editor
from aqt.qt import QClipboard, QTimer
from aqt.reviewer import Reviewer, ReviewerBottomBar
from aqt.browser.previewer import MultiCardPreviewer
from aqt.utils import showText, tooltip
from aqt.operations.note import update_note
from aqt.theme import theme_manager

from .semieditor import SemiEditorWebView
from .ankiaddonconfig import ConfigManager

from .localization.lang import q, _translations

ERROR_MSG = q("q_ERROR-Edit_Field_During_Review_Cloze") + "\n{}"

editorwv = SemiEditorWebView()


class FldNotFoundError(Exception):
    def __init__(self, fld: str):
        self.fld = fld

    def __str__(self) -> str:
        return f"{q('q_Field')} {self.fld} {q('q_not_found_in_note_Please_check_your_note_type')}"


conf = ConfigManager()


def myRevHtml() -> str:
    conf.load()  # update config when reviewer is launched

    # Adding translations to the existing config
    config_with_translations = add_translations_to_config(conf._config)

    js_config = json.dumps(config_with_translations, ensure_ascii=False)    
    # js_config = js_config.replace("'", "\\'") # Additional protection against single quotes

    # config should not have any single quote values
    # js = "EFDRCE.registerConfig('{}');".format(conf.to_json())    
    js = f"EFDRCE.registerConfig('{js_config}');"
    js += "EFDRCE.setupReviewer();"
    js += "EFDRCE.setupClozeTools();"
    return f"<script>{js}</script>"


def escape_single_quotes(d: dict) -> None:
    """Preparing for transfer to JS"""
    for key, value in d.items():
        if isinstance(value, str):
            if "'" in value:
                d[key] = value.replace("'", "~") #"\\'")


def add_translations_to_config(config: dict) -> dict:
    """Adds command translations to the config."""
    # Create a copy of the config
    config = config.copy()
    
    # Other translations that need to be passed to JS
    if "q" not in config:
        config["q"] = {}

    qb = config["q"]

    # print("theme_manager.night_mode = ", str(theme_manager.night_mode))
    q_translations = {
        "night_mode": ("night_css" if theme_manager.night_mode else "light_css"),               
    }

    # Add ALL translations from _translations
    q_translations["night_mode"] = base64.b64encode(q_translations["night_mode"].encode("utf-8")).decode("ascii")
    if _translations:       
        for i, (key, value) in enumerate(_translations.items()):                      
            q_translations[key] = base64.b64encode(value.encode("utf-8")).decode("ascii")
    

    # escape_single_quotes(q_translations)
    qb.update(q_translations)


    # Create a nameshortcuts structure if it doesn’t exist
    if "cloze_tools" not in config:
        config["cloze_tools"] = {}
    
    if "nameshortcuts" not in config["cloze_tools"]:
        config["cloze_tools"]["nameshortcuts"] = {}
    
    # Get or create a nameshortcuts object
    nameshortcuts = config["cloze_tools"]["nameshortcuts"]
    
    # Adding translations for all commands 
    command_translations = {
        "night_mode": ("night_css" if theme_manager.night_mode else "light_css"),
        "remove_single": q("q_Commands_remove_single"),
        "remove_all": q("q_Commands_remove_all"),
        "remove_same_number": q("q_Commands_remove_same_number"),
        "increment": q("q_Commands_increment"),
        "decrement": q("q_Commands_decrement"),
        "renumber": q("q_Commands_renumber"),
        "add_hint": q("q_Commands_add_hint"),
        "remove_hint": q("q_Commands_remove_hint"),
        "word_count_hint": q("q_Commands_word_count_hint"),
        "hint_from_selection": q("q_Commands_hint_from_selection"),
        "split_cloze": q("q_Commands_split_cloze"),
        "merge_clozes": q("q_Commands_merge_clozes"),
        "move_out_of_cloze": q("q_Commands_move_out_of_cloze"),
        "move_into_cloze": q("q_Commands_move_into_cloze"),
        "image_to_cloze": q("q_Commands_image_to_cloze"),
        "jump_prev_cloze": q("q_Commands_jump_prev_cloze"),
        "jump_next_cloze": q("q_Commands_jump_next_cloze"),        
        "jump_to_beginning_cloze": q("q_Commands_jump_to_beginning_cloze"),
        "jump_to_end_cloze": q("q_Commands_jump_to_end_cloze"),
        "jump_to_beginning": q("q_Commands_jump_to_beginning"),
        "jump_to_end": q("q_Commands_jump_to_end"),
        "toggle_overlay": q("q_Commands_toggle_overlay"),
        "copy_cloze_content": q("q_Commands_copy_cloze_content"),
        "preview_card": q("q_Commands_preview_card"),
        "find_replace": q("q_Commands_find_replace"),
        "suggest_clozes": q("q_Commands_suggest_clozes"),
        "replay_question": q("q_Commands_replay_question"),
    }
    
    # escape_single_quotes(command_translations)
    # Update nameshortcuts
    nameshortcuts.update(command_translations)    
    return config


def edit_filter(txt: str, field: str, filt: str, ctx: TemplateRenderContext) -> str:
    if not filt == "edit":
        return txt
    # Encode field to escape special characters.
    class_name = ""
    if conf["outline"]:
        class_name += "EFDRCE-outline "
    if conf["ctrl_click"]:
        class_name += "EFDRCE-ctrl "
    field = base64.b64encode(field.encode("utf-8")).decode("ascii")
    txt = """<%s data-EFDRCEfield="%s" class="%s">%s</%s>""" % (
        conf["tag"],
        field,
        class_name,
        txt,
        conf["tag"],
    )
    return txt


def serve_card(txt: str, card: Card, kind: str) -> str:
    return txt + "<script>EFDRCE.serveCard()</script>"


def save_field_and_reload(
        note: Note, 
        fld: str, 
        val: str, 
        context: Union[Reviewer, MultiCardPreviewer]
) -> None:    
    if fld == "Tags":
        # aqt.editor.Editor.saveTags
        tags = mw.col.tags.split(val)
        if note.tags == tags:
            return
        note.tags = tags
    elif fld not in note:
        raise FldNotFoundError(fld)
    else:
        # aqt.editor.Editor.onBridgeCmd
        txt = Editor.mungeHTML(editorwv.editor, val)
        if note[fld] == txt:
            return
        note[fld] = txt
    # 2.1.45+

    def on_success(changes: OpChanges) -> None:
        reload_review_context(context)
    
    def on_failure(exc: Exception) -> None:
        reload_review_context(context)
        raise exc

    update_note(
        parent=mw, note=note
    ).success(on_success).failure(on_failure).run_in_background()


def get_value(note: Note, fld: str) -> str:
    if fld == "Tags":
        try:
            string_tags = note.string_tags()
        except:
            string_tags = note.stringTags() # type:ignore
        return string_tags.strip(" ")
    if fld in note:
        return note[fld]
    raise FldNotFoundError(fld)

def autoplay_false() -> bool:
    return False

def reload_reviewer(reviewer: Reviewer) -> None:
    cid = reviewer.card.id
    try:
        timer_started = reviewer.card.timer_started
        timer_started_snake_case = True
    except:
        timer_started = reviewer.card.timerStarted  # type: ignore
        timer_started_snake_case = False
    reviewer.card = mw.col.getCard(cid) # type: ignore
    if timer_started_snake_case:
        reviewer.card.timer_started = timer_started
    else:
        reviewer.card.timerStarted = timer_started  # type: ignore

    original_autoplay = reviewer.card.autoplay
    will_disable_autoplay = conf.get("disable_autoplay_after_edit", False)
    if will_disable_autoplay:
        reviewer.card.autoplay = autoplay_false # type: ignore

    try:
        if reviewer.state == "question":
            reviewer._showQuestion()
        elif reviewer.state == "answer":
            reviewer._showAnswer()
    finally:    
        if will_disable_autoplay:
            reviewer.card.autoplay = original_autoplay # type: ignore

def reload_previewer(previewer: MultiCardPreviewer) -> None:
    # previewer may skip rendering if modified note's mtime has not changed
    previewer._last_state = None
    previewer.render_card()

def reload_review_context(context: Union[Reviewer, MultiCardPreviewer]) -> None:
    if isinstance(context, Reviewer):
        reload_reviewer(context)
    else:
        reload_previewer(context)

def handle_pycmd_message(
    handled: Tuple[bool, Any], message: str, context: Any
) -> Tuple[bool, Any]:
    if isinstance(context, Reviewer):
        card = context.card
        web: "aqt.webview.AnkiWebView" = context.web
        reviewer = context
        previewer = None
    elif isinstance(context, MultiCardPreviewer):
        if context._web is None:            
            return handled
        card = context.card()
        web = context._web        
        reviewer = None
        previewer = context
    else:        
        return handled

    if message.startswith("EFDRCE#"):        
        errmsg = q("q_Something_unexpected_occured_The_edit_may_not_have_been_saved")
        nidstr, fld, new_val = message.replace("EFDRCE#", "").split("#", 2)
        nid = int(nidstr)
        note = card.note()
        if note.id != nid:
            # nid may be note id of previous reviewed card
            tooltip(ERROR_MSG.format(errmsg))
            return (True, None)
        fld = base64.b64decode(fld, validate=True).decode("utf-8")
        try:
            save_field_and_reload(note, fld, new_val, context)
            return (True, None)
        except FldNotFoundError as e:
            tooltip(ERROR_MSG.format(str(e)))
            return (True, None)

    # Replace reviewer field html if it is different from real field value.
    # For example, clozes, mathjax, audio.
    elif message.startswith("EFDRCE!focuson#"):
        fld = message.replace("EFDRCE!focuson#", "")
        decoded_fld = base64.b64decode(fld, validate=True).decode("utf-8")
        note = card.note()
        try:
            val = get_value(note, decoded_fld)
        except FldNotFoundError as e:
            tooltip(ERROR_MSG.format(str(e)))
            return (True, None)
        encoded_val = base64.b64encode(val.encode("utf-8")).decode("ascii")
        web.eval(f"EFDRCE.showRawField('{encoded_val}', '{note.id}', '{fld}')")

        # Reset timer from Speed Focus Mode add-on.
        if reviewer is not None:
            reviewer.bottom.web.eval("window.EFDRCEResetTimer()")
        return (True, None)

    elif message == "EFDRCE!reload":
        reload_review_context(context)
        return (True, None)

    elif message == "EFDRCE!showQuestion":
        # Replay the question (front) of the card without undoing edits
        if reviewer is not None:
            reviewer._showQuestion()
        return (True, None)
        # Catch ctrl key presses from bottom.web.
    elif message == "EFDRCE!ctrldown":
        web.eval("EFDRCE.ctrldown()")
        return (True, None)
    elif message == "EFDRCE!ctrlup":
        web.eval("EFDRCE.ctrlup()")
        return (True, None)

    # elif message == "EFDRCE!clearAllFormatting":
    #     web.onCut()
    #     def cut_in_removeformatALL(): 
    #         mime = mw.app.clipboard().mimeData(mode=QClipboard.Mode.Clipboard)
    #         html, internal = editorwv._processMime(mime)        
    #         html = editorwv.editor._pastePreFilter(html, internal)
    #         internal = "true"
    #         ext = "false"            
    #         web.eval(f"EFDRCE.pasteHTML({json.dumps(html)}, {json.dumps(internal)}, {ext});")
    #     QTimer.singleShot(50, cut_in_removeformatALL)
    #     return (True, None)

    elif message == "EFDRCE!paste":
        # From aqt.editor.Editor._onPaste, doPaste.
        mime = mw.app.clipboard().mimeData(mode=QClipboard.Mode.Clipboard)
        html, internal = editorwv._processMime(mime)                
        html = editorwv.editor._pastePreFilter(html, internal)        
        web.eval(
            "EFDRCE.pasteHTML(%s, %s);" % (json.dumps(html), json.dumps(internal))
        )
        return (True, None)
    
    elif message == "EFDRCE!pasteEXT":
        # From aqt.editor.Editor._onPaste, doPaste.
        mime = mw.app.clipboard().mimeData(mode=QClipboard.Mode.Clipboard)
        html, internal = editorwv._processMime(mime)                
        html = editorwv.editor._pastePreFilter(html, internal)        
        extended = True
        internal = "false"
        if extended:
            ext = "true"
        else:
            ext = "false"
        web.eval(f"EFDRCE.pasteHTML({json.dumps(html)}, {json.dumps(internal)}, {ext});")

        # web.eval(
        #     "EFDRCE.pasteHTML(%s, %s);" % (json.dumps(html), json.dumps(internal))
        # )
        return (True, None)
    

    # elif message == "EFDRCE!pasteNOEXT":
    #     # From aqt.editor.Editor._onPaste, doPaste.
    #     mime = mw.app.clipboard().mimeData(mode=QClipboard.Mode.Clipboard)
    #     html, internal = editorwv._processMime(mime)        
    #     # html = editorwv.editor._pastePreFilter(html, internal)
    #     internal = "true"
    #     ext = "false"
    #     print(" ===HTML=== \n", html)
    #     web.eval(f"EFDRCE.pasteHTML({json.dumps(html)}, {internal}, {ext});")
    #     # web.eval(f"document.execCommand('inserthtml', false, {json.dumps(html)});")
    #     return (True, None)

    elif message.startswith("EFDRCE!debug#"):
        fld = message.replace("EFDRCE!debug#", "")
        showText(fld)
        return (True, None)
    return handled


def url_from_fname(file_name: str) -> str:
    addon_package = mw.addonManager.addonFromModule(__name__)
    return f"/_addons/{addon_package}/web/{file_name}"


def on_webview(web_content: aqt.webview.WebContent, context: Optional[Any]) -> None:
    if isinstance(context, Reviewer) or isinstance(context, MultiCardPreviewer):
        web_content.body += myRevHtml()
        web_content.body += f'<script type="module" src="{url_from_fname("editor/editor.js")}"></script>'
        js_contents = ["global_card.js", "resize.js", "cloze-tools.js"] 
        for file_name in js_contents:
            web_content.js.append(url_from_fname(file_name))
        jquery_ui = "js/vendor/jquery-ui.min.js"
        if jquery_ui not in web_content.js:
            web_content.js.append(jquery_ui)
        web_content.css.append(url_from_fname("global_card.css"))

    elif isinstance(context, ReviewerBottomBar):
        web_content.js.append(url_from_fname("bottom.js"))


mw.addonManager.setWebExports(__name__, r"web/.*")
gui_hooks.webview_will_set_content.append(on_webview)
gui_hooks.webview_did_receive_js_message.append(handle_pycmd_message)
gui_hooks.card_will_show.append(serve_card)
anki.hooks.field_filter.append(edit_filter)


# ============ MENU ITEMS ============

from aqt.qt import QAction

overlay_action = None

def toggle_cloze_overlay(checked):
    """Toggle the cloze info overlay in the reviewer"""
    # Save to config
    conf.load()
    conf.set("cloze_tools.auto_show_overlay", checked)
    conf.save()

    # Update JS state
    if mw.reviewer and mw.reviewer.web:
        if checked:            
            mw.reviewer.web.eval("""
            if (EFDRCE && EFDRCE.clozeTools) {
                if(EFDRCE.CONF?.cloze_tools?.auto_show_overlay) {
                    EFDRCE.CONF.cloze_tools.auto_show_overlay = false;
                }
                EFDRCE.clozeTools.toggleClozeOverlay(null, document.activeElement);                                
            }
            """)
        else:
            mw.reviewer.web.eval("""
            if (EFDRCE && EFDRCE.clozeTools) {
                if(EFDRCE.CONF?.cloze_tools?.auto_show_overlay) {
                    EFDRCE.CONF.cloze_tools.auto_show_overlay = true;
                }
                EFDRCE.clozeTools.toggleClozeOverlay(null, document.activeElement);                                                               
            }
            """)
        

def setup_menu():
    """Add menu items to Tools menu"""
    global overlay_action
    overlay_action = QAction(q("q_Show_Cloze_Info_Overlay"), mw)
    overlay_action.setShortcut("Ctrl+Shift+Alt+T")
    overlay_action.setCheckable(True)    
    # Load saved state from config
    auto_show = conf.get("cloze_tools", {}).get("auto_show_overlay", False)
    overlay_action.setChecked(auto_show)
    overlay_action.triggered.connect(toggle_cloze_overlay)
    mw.form.menuTools.addAction(overlay_action)

# Setup menu when Anki loads
setup_menu()
