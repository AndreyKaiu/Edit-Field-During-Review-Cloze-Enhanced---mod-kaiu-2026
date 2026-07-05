Modifying the addon code "Edit Field During Review (Cloze) Enhanced".

Original addon [https://ankiweb.net/shared/info/1757654367](https://ankiweb.net/shared/info/1757654367).

The author hasn't contacted me, the email address isn't listed on GitHub, and after two weeks, the account https://github.com/SumanthC10 is no longer accessible.

We'll consider https://github.com/SumanthC10 the add-on's author. I'm quite happy with being a co-author, as many of the ideas weren't mine.

I needed to fix the add-on, redesign it to work with HTML code in Cloze, integrate my own functions into the add-on, and, of course, make it translatable.

If you translate the add-on into your language, please send me the *.lng file, and I'll add it so others can use it.

I tried to demonstrate some of the functions below (no more than 5 minutes, and the quality was such that it fits within GitHub's requirements for a single file).

![Edit field d](https://github.com/user-attachments/assets/e432274e-9fdb-4111-b3f3-508f996c4598)

How to use it? Read here [https://ankiweb.net/shared/info/385888438](https://ankiweb.net/shared/info/385888438)

#### Quick Start Guide

**Initial Setup**

1. Open the add-on config and go to the Fields tab
2. For each note type, check the fields you want editable
3. Done! Now Ctrl + Click on any field to edit it
   
**Command Palette**

Ctrl+. - Open searchable command palette with ALL actions 

**Cloze Removal**

Ctrl+Shift+R - Remove cloze at cursor/selection

Ctrl+Shift+U - Remove ALL clozes in field

Ctrl+Shift+Alt+R - Remove clozes with same number 

**Cloze Numbering**

Ctrl+Shift+Alt+K - Increment number

Ctrl+Shift+Alt+J - Decrement number

Ctrl+Shift+Alt+N - Renumber (then press 1-9) 

**Hints**

Ctrl+Shift+L - Add/edit hint

Ctrl+Shift+Alt+L - Remove hint

Ctrl+Shift+W - Word count hint

Ctrl+Shift+Alt+S - Use selection as hint 

**Cloze Structure**

Ctrl+Shift+S - Split cloze at selection

Ctrl+Shift+Alt+M - Merge same-number clozes

Ctrl+Shift+O - Move selection out of cloze

Ctrl+Shift+Alt+O - Move selection into cloze

Ctrl+Shift+Alt+I - Convert image to cloze 

**Navigation**

Ctrl+\[ - Jump to previous cloze

Ctrl+\] - Jump to next cloze

Ctrl+Shift+\[ - Jump to beginning cloze

Ctrl+Shift+\] - Jump to end cloze

Ctrl+Shift+Alt+, - Jump to beginning (or \[Ctrl+Home\])

Ctrl+Shift+Alt+. - Jump to end (or \[Ctrl+End\])

Ctrl+Shift+Alt+F - Replay question (show front) 

**Tools**

Ctrl+Shift+Alt+T - Toggle cloze info overlay

Ctrl+Shift+Alt+Y - Copy cloze content (and select)

Ctrl+Shift+Alt+P - Preview card

Ctrl+Shift+Alt+G - Find & replace in clozes

Ctrl+Shift+G - Suggest cloze candidates 

Tip: Use Ctrl+. to search all commands! 

**Some important changes and additions**

The addon's source code primarily supported only plain text within cloze.

This version of the addon includes changes to better support HTML code within cloze.

Processing of inserted text for images and HTML can be toggled with Alt+V. This is important to know so that you can insert specific parts of HTML text.

You can display information about cloze completion and partially view the HTML code near the cursor to better understand the actual formatting.

The `removeformatALL` command (Ctrl + Shift + -) has been added, which removes any tags (if no text is selected, it removes one tag). The standard `removeformat` command also exists, but it only removes basic 
tags, not all.

The ability to enter a non-breaking space character (Ctrl + Shift + Space) has been added, as this is sometimes needed.

Commands for entering tags `<w0>...<w9>` have been added for your own styles, or you can use them for your own tags. The $$ symbols indicate the insertion point for the text you are selecting.

Due to the large number of commands and the complexity of the HTML code, some formatting errors are possible. Check the HTML code at the cursor (the panel at the bottom of the screen: Ctrl + Shift + Alt + T).

**HELP AND SUPPORT**

**Please do not use reviews for bug reports or support requests.**<br>
**And be sure to like,** as your support is always needed. Thank you.
I don't get notified of your reviews, and properly troubleshooting an issue through them is nearly impossible. Instead, please either use the [issue tracker (preferred),](https://github.com/AndreyKaiu/Edit-Field-During-Review-Cloze-Enhanced---mod-kaiu-2026/issues) add-on, or just message me at [andreykaiu@gmail.com.](mailto:andreykaiu@gmail.com) Constructive feedback and suggestions are always welcome!

**VERSIONS**

- 6.23.1, date: 2026-07-05. For Anki 24.04.1
- 6.23.1, date: 2026-02-16. 




