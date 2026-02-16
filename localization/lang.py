# -*- coding: utf-8 -*-
# Copyright: (C) kaiu <https://github.com/AndreyKaiu>
# License: GNU GPL version 3 or later <https://www.fsf.org/>
# Version 1.0, date: 2026-01-08
""" addon localization language """

from aqt import mw
import anki.lang
from aqt.utils import (showText, showInfo, tooltip) 

import os
import json
from typing import Dict, List, Tuple
from . import adv_settings

_translations: Dict[str, str] = {} # Current translations (only downloaded for the active language)
_language: str = "en" # Default language if not changed using 'set_lang'
_language_full_name = "English (United States)"

def set_lang(language : str):    
    """ Set the addon localization language (only if the 'language.lng' file exists) """
    global _language, _translations
    normalized_lang = language.replace("-", "_")
    current_dir = os.path.dirname(os.path.abspath(__file__))
    translation_file = f"{normalized_lang}.lng"
    translation_path = os.path.join(current_dir, translation_file)    
    if not os.path.exists(translation_path) and os.path.isfile(translation_path):
        return False     
    else:
        result = adv_settings.load_lng(translation_path, logging_to_screen = False)
        if result:            
            _translations = result
            _language = language
            _language_full_name = get_lang_full_name(language) 
            return True
        else:
            return False 


def q(key: str, default: str = "") -> str:
    """Get translation for a key with optional default value"""
    global _translations
    key = key.strip() # the key must have no spaces at the beginning and end
    if str == "":
        default = key    
    return _translations.get(key, default)

def get_translation(key: str, default: str = "") -> str:
    """Get translation for a key with optional default value (long function name _)"""
    return q(key, default)

def get_lang() -> str:
    """ Get the addon's localization language """
    global _language
    return _language

def get_lang_full_name(language : str) -> str:
    """ Get the full name of the add-on's localization language """
    global langs, compatMapSort 
    langs_dict = {code: name for name, code in langs} 
    compatMap_dict = {code2sm: code4sm for code2sm, code4sm in compatMapSort} 
    if language in langs_dict: 
        return langs_dict[language]  
    elif language in compatMap_dict:
        cd4 = compatMap_dict[language]  
        if cd4 in langs_dict: 
            return langs_dict[cd4]
    return language   
    

def get_available_languages() -> List[Tuple[str, str]]:
    """
    Get all available translation files in the current directory.
    Returns:
        List of tuples (language_name, language_code) for available 'lng' files.
        If language name not found in langs list, uses filename as both name and code.
    """   
    global langs, compatMapSort 
    current_dir = os.path.dirname(os.path.abspath(__file__))
    langs_dict = {code: name for name, code in langs} 
    compatMap_dict = {code2sm: code4sm for code2sm, code4sm in compatMapSort}       
    available = []
    
    # Search for all 'lng' files in the directory
    for filename in os.listdir(current_dir):
        if filename.lower().endswith('.lng'):
            # Extracting the language code from a file name (without extension)
            language = filename[:-5]  # del ".lng"                 
            if language in langs_dict: 
                available.append(langs_dict[language], language)   
            elif language in compatMap_dict:
                cd4 = compatMap_dict[language]  
                if cd4 in langs_dict: 
                    available.append(langs_dict[cd4], language)
                else:
                    available.append(language, language)
            else:
                available.append(language, language)
                
    available.sort(key=lambda x: x[0].lower())
    return available



langs = sorted(
    [
        ("Afrikaans", "af_ZA"),
        ("Bahasa Melayu", "ms_MY"),
        ("Català", "ca_ES"),
        ("Dansk", "da_DK"),
        ("Deutsch", "de_DE"),
        ("Eesti", "et_EE"),
        ("English (United States)", "en_US"),
        ("English (United Kingdom)", "en_GB"),
        ("Español", "es_ES"),
        ("Esperanto", "eo_UY"),
        ("Euskara", "eu_ES"),
        ("Français", "fr_FR"),
        ("Galego", "gl_ES"),
        ("Hrvatski", "hr_HR"),
        ("Italiano", "it_IT"),
        ("lo jbobau", "jbo_EN"),
        ("Lenga d'òc", "oc_FR"),
        ("Magyar", "hu_HU"),
        ("Nederlands", "nl_NL"),
        ("Norsk", "nb_NO"),
        ("Polski", "pl_PL"),
        ("Português Brasileiro", "pt_BR"),
        ("Português", "pt_PT"),
        ("Română", "ro_RO"),
        ("Slovenčina", "sk_SK"),
        ("Slovenščina", "sl_SI"),
        ("Suomi", "fi_FI"),
        ("Svenska", "sv_SE"),
        ("Tiếng Việt", "vi_VN"),
        ("Türkçe", "tr_TR"),
        ("简体中文", "zh_CN"),
        ("日本語", "ja_JP"),
        ("繁體中文", "zh_TW"),
        ("한국어", "ko_KR"),
        ("Čeština", "cs_CZ"),
        ("Ελληνικά", "el_GR"),
        ("Български", "bg_BG"),
        ("Монгол хэл", "mn_MN"),
        ("Pусский язык", "ru_RU"),
        ("Српски", "sr_SP"),
        ("Українська мова", "uk_UA"),
        ("Հայերեն", "hy_AM"),
        ("עִבְרִית", "he_IL"),
        ("العربية", "ar_SA"),
        ("فارسی", "fa_IR"),
        ("ภาษาไทย", "th_TH"),
        ("Latin", "la_LA"),
        ("Gaeilge", "ga_IE"),
        ("Беларуская мова", "be_BY"),
        ("ଓଡ଼ିଆ", "or_OR"),
        ("Filipino", "tl"),
        ("ئۇيغۇر", "ug"),
    ]
)


# compatibility with old versions
compatMapSort = sorted(
    [
        ("af", "af_ZA"),
        ("ar", "ar_SA"),
        ("be", "be_BY"),
        ("bg", "bg_BG"),
        ("ca", "ca_ES"),
        ("cs", "cs_CZ"),
        ("da", "da_DK"),
        ("de", "de_DE"),
        ("el", "el_GR"),
        ("en", "en_US"),
        ("eo", "eo_UY"),
        ("es", "es_ES"),
        ("et", "et_EE"),
        ("eu", "eu_ES"),
        ("fa", "fa_IR"),
        ("fi", "fi_FI"),
        ("fr", "fr_FR"),
        ("gl", "gl_ES"),
        ("he", "he_IL"),
        ("hr", "hr_HR"),
        ("hu", "hu_HU"),
        ("hy", "hy_AM"),
        ("it", "it_IT"),
        ("ja", "ja_JP"),
        ("jbo", "jbo_EN"),
        ("ko", "ko_KR"),
        ("la", "la_LA"),
        ("mn", "mn_MN"),
        ("ms", "ms_MY"),
        ("nl", "nl_NL"),
        ("nb", "nb_NL"),
        ("no", "nb_NL"),
        ("oc", "oc_FR"),
        ("or", "or_OR"),
        ("pl", "pl_PL"),
        ("pt", "pt_PT"),
        ("ro", "ro_RO"),
        ("ru", "ru_RU"),
        ("sk", "sk_SK"),
        ("sl", "sl_SI"),
        ("sr", "sr_SP"),
        ("sv", "sv_SE"),
        ("th", "th_TH"),
        ("tr", "tr_TR"),
        ("uk", "uk_UA"),
        ("vi", "vi_VN")
    ]
)
