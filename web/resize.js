/* global $, EFDRCE */

(function () {
  EFDRCE.priorImgs = []

  const savePriorImg = function (img) {
    const id = EFDRCE.priorImgs.length
    EFDRCE.priorImgs.push(img.cloneNode())
    img.setAttribute('data-EFDRCEImgId', id)
  }

  const ratioShouldBePreserved = function (event) {
    if (EFDRCE.CONF.resize_image_preserve_ratio === 1 && event.originalEvent.target.classList.contains('ui-resizable-se')) {
      return true
    } else if (EFDRCE.CONF.resize_image_preserve_ratio === 2) {
      return true
    } else {
      return false
    }
  }

  const maybeRemoveHeight = function (img, $img, ui) {
    if (!img.naturalHeight) { return }
    const originalRatio = img.naturalWidth / img.naturalHeight
    const currentRatio = $img.width() / $img.height()
    if (Math.abs(originalRatio - currentRatio) < 0.01 || EFDRCE.CONF.resize_image_preserve_ratio === 2) {
      $img.css('height', '')
      if (ui) {
        ui.element.css('height', $img.height())
      }
    }
  }

  const onDblClick = function () {
    const img = this
    const $img = $(img)
    $img.css('width', '')
    $img.css('height', '')
    const $parents = $img.parents('div[class^=ui-]')
    $parents.css('width', '')
    $parents.css('height', '')
  }


  EFDRCE.resizeImage = async function (idx, img) {
    while (!img.complete) {
      // wait for image to load
      await new Promise(resolve => setTimeout(resolve, 20))
    }

    savePriorImg(img)

    const $img = $(img)
    if ($img.resizable('instance') === undefined) { // just in case?
      const aspRatio = (EFDRCE.CONF.resize_image_preserve_ratio === 2)
      const computedStyle = window.getComputedStyle(img)

      $img.resizable({
        start: function (event, ui) {
          if (ratioShouldBePreserved(event)) {
            // preserve ratio when using corner point to resize
            $img.resizable('option', 'aspectRatio', true).data('ui-resizable')._aspectRatio = true
          }
        },
        stop: function (event, ui) {
          $img.resizable('option', 'aspectRatio', false).data('ui-resizable')._aspectRatio = false
          maybeRemoveHeight(img, $img, ui) // this might not be working
        },
        resize: function (event, ui) {
          if (ratioShouldBePreserved(event)) {
            maybeRemoveHeight(img, $img, ui)
          }
        },
        classes: {
          // remove unneeded classes
          'ui-resizable-se': ''
        },
        minHeight: 15,
        minWidth: 15,
        aspectRatio: aspRatio
      })

      // passing maxWidth to resizable doesn't work because
      // it only takes in pixel values
      const ui = $img.resizable('instance')
      ui.element.css('max-width', computedStyle.maxWidth)
      ui.element.css('max-height', computedStyle.maxHeight)
      $img.css('max-width', '100%')
      $img.css('max-height', '100%')
      if (parseFloat(computedStyle.minWidth)) { // not 0
        ui.element.css('min-width', computedStyle.minWidth)
      }
      if (parseFloat(computedStyle.minHeight)) {
        ui.element.css('min-height', computedStyle.minHeight)
      }

      $img.dblclick(onDblClick)
      const $divUi = $img.parents('div[class=ui-wrapper]')
      $divUi.attr('contentEditable', 'false')
      $divUi.css('display', 'inline-block')
    }
  }


  EFDRCE.cleanResize = function (field) {
    if (!field || !field.querySelectorAll) return
    
    // 1. We process ALL images
    const allImages = field.querySelectorAll('img')
    
    for (const img of allImages) {
      // Keeping the current dimensions
      const currentWidth = img.style.width || img.getAttribute('width')
      const currentHeight = img.style.height || img.getAttribute('height')
      
      // Completely reset ALL styles
      img.removeAttribute('style')
      
      // We remove ALL attributes associated with resizable
      img.removeAttribute('data-EFDRCEImgId')
      img.removeAttribute('data-efdrceimgid')
      
      // We delete classes and the class ATTRIBUTE ITSELF if it is empty
      img.classList.remove('ui-resizable', 'ui-resizable-resizing')
      
      // Removing the empty class attribute
      if (!img.className.trim()) {
        img.removeAttribute('class')
      }
      
      // We restore only the dimensions if they exist.
      if (currentWidth) {
        img.style.width = currentWidth
      }
      if (currentHeight) {
        img.style.height = currentHeight
      }
    }
    
    // 2. Remove all traces of jQuery UI
    const elementsToRemove = [
      '.ui-wrapper',
      '.ui-resizable-handle',
      'div[class^="ui-resizable-"]',
      '.ui-resizable'
    ]
    
    elementsToRemove.forEach(selector => {
      field.querySelectorAll(selector).forEach(el => {
        try {
          if (el.classList.contains('ui-wrapper')) {
            const img = el.querySelector('img')
            if (img && el.parentNode) {
              el.parentNode.replaceChild(img, el)
            }
          } else {
            el.remove()
          }
        } catch (e) {
          //ignore
        }
      })
    })
    
    // 3. Clearing jQuery data
    if (window.$) {
      field.querySelectorAll('*').forEach(el => {
        try {
          $(el).removeData('ui-resizable')
        } catch (e) {
          // ignore
        }
      })
    }
    
    // 4. Clearing the array
    EFDRCE.priorImgs = []
  }

  EFDRCE.maybeResizeOrClean = function (focus) {
    if (focus) {
      // Called from __init__.py on field focus. Else undefined.
      EFDRCE.resizeImageMode = EFDRCE.CONF.resize_image_default_state
    }
    if (EFDRCE.resizeImageMode) {
      $(document.activeElement).find('img').each(EFDRCE.resizeImage)
    } else {
      EFDRCE.cleanResize(document.activeElement)
    }
  }

  EFDRCE.CleanAndResize = function (elem) {
    EFDRCE.cleanResize(elem)
    if (EFDRCE.resizeImageMode) {
      $(document.activeElement).find('img').each(EFDRCE.resizeImage)
    }
  }

})()
