# -*- coding: utf-8 -*-
# Copyright: (C) kaiu <https://github.com/AndreyKaiu>
# License: GNU GPL version 3 or later <https://www.fsf.org/>
# Version 1.0, date: 2026-01-08
""" advanced settings to simplify translations """

import re
import os
import sys
from typing import Dict, Tuple, List, Optional, NamedTuple
from datetime import datetime


class BlockSettings(NamedTuple):
    """Separator settings for a specific block"""
    vbegin: str
    vend: str

class LngParser:
    def __init__(self):
        # Standard settings
        self.vs = "!!!"      # word at the beginning of the line that it is a setting line
        self.vb = "==="      # word to start the block (if there is a block name next)
        self.vbegin = "$"    # start of variable in text (define block name)
        self.vend = "$"      # end of variable in text (define block name)  
        self.comment = ";"   # beginning of a comment (not allowed inside text)
        
        # We store blocks and their settings
        self.blocks: Dict[str, Tuple[str, BlockSettings]] = {}

        # how many warnings and errors
        self.warnings = 0
        self.errors = 0

        # display log on screen
        self.logging_to_screen = True


    def log(self, message: str, limitError: bool = True):
        """Logs a message with a timestamp"""
        if not self.logging_to_screen:
            return
        if limitError and (self.warnings + self.errors > 20):   
            return
        now = datetime.now()
        timestamp = f"{now:%Y-%m-%d %H:%M:%S}.{now.microsecond // 1000:03d}"
        print(f"[{timestamp}] {message}")
    
    def _is_settings_line(self, line: str) -> bool:
        """Checks if a string is a settings string"""
        pattern = f'^{re.escape(self.vs)}(\\s|$)'
        return bool(re.match(pattern, line))
    
    def _is_block_start_line(self, line: str) -> bool:
        """Checks if a string is the start of a block"""
        pattern = f'^{re.escape(self.vb)}(\\s|$)'
        return bool(re.match(pattern, line))
    
    def parse_file(self, filepath: str) -> Dict[str, str]:
        """Parses the .lng file and returns a key->value dictionary (already with substitutions)"""
        self.log(f"======= Start parsing file: {filepath}")
        if not os.path.exists(filepath):
            self.log(f"ERROR. File not found: {filepath}")
            self.errors += 1
            return {}
        
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # how many warnings and errors
        self.warnings = 0
        self.errors = 0

        self._parse_blocks(lines)
        ret= self._resolve_all_references()
        self.log(f"======= Finishing file parsing: {filepath}", limitError = False)
        strer = "Errors" if self.errors <= 0 else "ERRORS"  
        strwr = "Warnings" if self.warnings <= 0 else "WARNINGS"
        strE7 = "=======" if self.errors == 0 and self.warnings == 0 else "==!!!=="            
        self.log(f"{strE7} {strer}: {self.errors}  {strwr}: {self.warnings}", limitError = False)
        return ret
       


    def _parse_blocks(self, lines: List[str]):
        """First pass: collecting all named blocks with their settings"""
        # A block can have multiple names (just a shorthand for representing blocks
        # since then the translator must implement them if necessary)
        current_block_names = []  
        current_block_content = []
        
        self.log("== 1 == First pass: simple reading...")

        # Default settings for the first block
        current_settings = BlockSettings(self.vbegin, self.vend)
        block_settings = current_settings
        n_line = 0  # line number
        
        for line in lines:
            line = line.rstrip('\n')
            n_line += 1            

            # Checking if a string is a settings string
            if self._is_settings_line(line) or (n_line == 1):
                # We save previous blocks if there are any
                if current_block_names:
                    self._save_blocks(current_block_names, current_block_content, block_settings, n_line)
                    current_block_content = []
                    current_block_names = []

                self._parse_settings_line(line)                
                # Update current settings after changes
                current_settings = BlockSettings(self.vbegin, self.vend)
                continue
            
            # Checking if a string is the beginning of a block
            if self._is_block_start_line(line):
                # We save previous blocks if there are any
                if current_block_names:
                    self._save_blocks(current_block_names, current_block_content, block_settings, n_line)
                    current_block_content = []
                    current_block_names = []
                
                block_settings = current_settings

                # Parsing the block string
                vb_len = len(self.vb)
                rest_start = vb_len
                if len(line) > vb_len and line[vb_len] == ' ':
                    rest_start = vb_len + 1
                
                rest = line[rest_start:] if rest_start < len(line) else ""
                rest_stripped = rest.strip()
                
                if rest_stripped:
                    parts = rest_stripped.split()
                    
                    # Collecting all block names before the comment
                    block_names = []
                    for part in parts:
                        if part == self.comment:
                            break  # Reached a comment
                        block_names.append(part)
                    
                    if block_names:
                        # Removing duplicate names
                        unique_names = []
                        for name in block_names:
                            if name not in unique_names:
                                unique_names.append(name)
                        
                        if len(unique_names) != len(block_names):
                            self.log(f"INFO Ln {n_line}: removed duplicate names, keeping only unique")
                        
                        current_block_names = unique_names
                    else:
                        # A line like "=== ; comment" is an empty block
                        current_block_names = []
                else:
                    # A line like "===" without anything after
                    current_block_names = []
                    
                continue
            
            # Add a line to the current blocks
            if current_block_names:
                current_block_content.append(line)
        
        # Saving the last blocks
        if current_block_names:
            self._save_blocks(current_block_names, current_block_content, block_settings, n_line)


    def _save_blocks(self, block_names: List[str], content: List[str], 
                    settings: BlockSettings, line_num: int):
        """Saves multiple blocks with the same content"""
        if not block_names:
            return
        
        block_text = '\n'.join(content).rstrip()
        
        # We check and save each block
        main_block = block_names[0]
        for i, block_name in enumerate(block_names):
            if block_name in self.blocks:
                if i == 0:
                    self.log(f"WARNING Ln {line_num}: block '{block_name}' is overwritten")
                    self.warnings += 1
                else:
                    # For other blocks the warning is milder
                    self.log(f"INFO Ln {line_num}: block '{block_name}' overwritten (created from multi-block declaration)")
            
            # Save the block
            self.blocks[block_name] = (block_text, settings)
        
        # Logging the creation of several blocks
        if len(block_names) > 1:
            self.log(f"INFO Ln {line_num}: created {len(block_names)} blocks with same content: {', '.join(block_names)}")
    

    def _parse_settings_line(self, line: str):
        """Parses the settings string"""
        # Find the first word before the space
        line_stripped = line.strip()  # Removing possible spaces at the beginning        
        # Divide into words
        words = line_stripped.split()        
        if not words:
            return  # Empty string, do nothing        
        # The first word is new vs
        new_vs = words[0]        
        # Checking if vs has changed
        if new_vs != self.vs:
            self.log(f"INFO: changing vs from '{self.vs}' to '{new_vs}'")
            self.vs = new_vs        
        # The remaining words (starting from the second) are settings
        if len(words) >= 5:  # minimum 5 words: vs, vb, vbegin, vend, comment
            # words[0] - this is vs which we have already installed
            self.vb = words[1] if len(words) > 1 else self.vb
            self.vbegin = words[2] if len(words) > 2 else self.vbegin
            self.vend = words[3] if len(words) > 3 else self.vend
            self.comment = words[4] if len(words) > 4 else self.comment
            
            self.log(f"INFO: settings updated - vb='{self.vb}', "
                    f"vbegin='{self.vbegin}', vend='{self.vend}', "
                    f"comment='{self.comment}'")
        elif len(words) > 1:  # There are some settings, but not all
            self.log(f"WARNING: incomplete settings line, expected 5 words, got {len(words)}")
            
    
    def _resolve_all_references(self) -> Dict[str, str]:
        """Resolves all references and returns the final dictionary"""
        resolved = {}
        self.log("== 2 == Second pass: recursive substitutions...")

        for block_name, (content, settings) in self.blocks.items():
            resolved[block_name] = self._resolve_block(content, block_name, settings)
        
        return resolved
    

    def _resolve_block(self, content: str, current_block_name: str, settings: BlockSettings) -> str:
        """Allows all links in one block, taking into account its settings"""
        vbegin_escaped = re.escape(settings.vbegin)
        vend_escaped = re.escape(settings.vend)
        pattern = f'{vbegin_escaped}(.+?){vend_escaped}'
        
        # Cache for aliases in this block
        aliases_cache = {}
        
        # Function for bat link
        def replace_match(match):
            full_match = match.group(0)
            inner = match.group(1).strip()
            
            if not inner:
                return full_match
            
            # Understandable: "var" or "var alias"
            parts = inner.split()
            var_name = parts[0]
            alias = parts[1] if len(parts) > 1 else None
            
            # Checking recursion
            if var_name == current_block_name:
                return full_match
            
            # Looking for a variable
            if var_name in self.blocks:
                var_content, var_settings = self.blocks[var_name]
                
                # Recursively resolve nested references in the found variable
                # but with her own settings!
                resolved_var = self._resolve_block(var_content, var_name, var_settings)
                
                # If there is an alias, remember it for this block
                if alias:
                    if alias in aliases_cache:
                            self.log(f"WARNING block '{current_block_name}': alias '{alias}' was overwritten. Is this really what you wanted?")     
                            self.warnings += 1 
                    aliases_cache[alias] = resolved_var
                
                return resolved_var
            

            # Let's check if it's an alias from the cache.          
            if var_name in aliases_cache:
                if alias is not None:
                    self.log(f"ERROR block '{current_block_name}', substitution '{inner}': It is not allowed to create an alias for an alias!")     
                    self.errors += 1
                return aliases_cache[var_name]
            else:                
                self.log(f"ERROR block '{current_block_name}', substitution '{var_name}' was not found! ('{inner}')")   
                self.errors += 1
            
            return full_match
        
        
        # Replace links (maximum 10 iterations for complex cases)
        result = content        
        for _ in range(10):
            new_result = re.sub(pattern, replace_match, result)
            if new_result == result:
                break
            result = new_result                      

        
        return result


def load_lng(filepath: str, logging_to_screen : bool = False) -> Dict[str, str]:
    """Loads a .lng file and returns a translation dictionary"""
    parser = LngParser()
    parser.logging_to_screen = logging_to_screen
    ret = parser.parse_file(filepath)
    if parser.errors > 0:     
        return {}
    else:
        return ret


# Testing (if called as a program and not a module)
if __name__ == "__main__":
    # Checking if there are command line arguments
    if len(sys.argv) > 1:
        # There are arguments -we process the file
        filename = sys.argv[1]        
        # Checking the existence of the file
        if not os.path.exists(filename):
            print(f"Error: file '{filename}' not found")
            sys.exit(1)        
        # Checking the extension
        if not filename.lower().endswith('.lng'):
            print(f"Warning: file '{filename}' does not have a .lng extension")        
        print(f"Testing the file: {filename}")
        print("=" * 50)

        # Loading with logging enabled
        try:
            result = load_lng(filename, logging_to_screen=True)            
            # print("\nParsing result:")
            # print("-" * 30)
            # for key, value in result.items():
            #     print(f"  {key}: {repr(value)}")            
            print(f"Total: {len(result)} translations")
            
        except Exception as e:
            print(f"Error processing file: {e}")
            sys.exit(1)
            
    else:
        # No arguments -run standard tests


        # Test 1: Changing delimiters within a file
        test1 = """@@@ === $ $ ; setting, block separator, variable start and end, comment start marker
=== block1 ; a separator is specified, the name of the block and below is the text of the block in which there is a variable (the name of another block)
Text with $var1$ link
@@@ === « » # ; change the settings for the following blocks
=== var1
Substitution
=== block2 # in this block, the block reference (variable) is set to “ ”
Text with «var1» reference """
        
        print("Test 1 -Changing separators:")
        with open('test1.lng', 'w', encoding='utf-8') as f:
            f.write(test1)
        
        result = load_lng('test1.lng', logging_to_screen = True)
        for key, value in result.items():
            print(f"  {key}: {value}")
        
        # Test 2: Nested links with different settings
        test2 = """!!! === $ $ ; setting, block separator, variable start and end, comment start marker
=== company ; company information
"Volkswagen Group"
=== text1 ; when it works
$company$ works
=== 
!!! *** { } % let's change the setting
*** text2 % check for two
{text1} successfully. Contacts: {company}, tel.:12345
***
!!! === $ $ ; let's return the setting
=== text3 ; output for three
$text2$ The financial performance of $company$ is not very good. $text1$ has been having some difficulties lately!
"""

        
        print("\nTest 2 -Nested links with different settings:")
        with open('test2.lng', 'w', encoding='utf-8') as f:
            f.write(test2)
        
        result = load_lng('test2.lng', logging_to_screen = True)
        for key, value in result.items():
            print(f"  {key}: {value}")
        
        # Test 3: Difficult case with aliases
        test3 = """!!! === $ $ ; setting, block separator, variable start and end, comment start marker
=== per1 per1_todo_new 
111
===
=== per2 
222 and per1=$per1_todo_new$
=== ; on the line below v_1per3 v_1per2 are not full aliases,
=== ; this is a replacement for recording 3 blocks with the same content
=== per3 v_1per3 v_1per2
333 $per1 q2$ $q2$ $per2 q1$ $q1$ 
=== ; on the line above $per1 q2$ an alias (short name) is created which is convenient
=== ; apply then only in this block!
=== per4
444 $per1 q1$ $q1$ --- $per2 q3$ $q3$ +++ per3: $per3 q2$
===

=== company ; company information
"Volkswagen Group"
=== text1 ; when it works
$company$ works
=== 
!!! *** { } % let's change the setting
*** text2 % check for two
{text1} successfully. Contacts: {company}, tel.:12345
***
!!! === $ $ ; let's return the setting
=== text3 ; output for three
$text2$
The financial performance of $company$ is not very good.
$text1$ has been having some difficulties lately!
We output per4:
$per4 a1$
And once again per4 through an alias:
$a1$"""
        
        print("\nTest 3 -Difficult case with aliases:")
        with open('test3.lng', 'w', encoding='utf-8') as f:
            f.write(test3)
        
        result = load_lng('test3.lng', logging_to_screen = True)
        for key, value in result.items():        
            print(f"  {key}: {value}")
        
        # Cleaning
        for fname in ['test1.lng', 'test2.lng', 'test3.lng']:
            if os.path.exists(fname):
                os.remove(fname)