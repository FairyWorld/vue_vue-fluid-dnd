import {
  AddCssStylesToElement,
  assignDraggingEvent,
  convetEventToDragMouseTouchEvent,
  moveTranslate,
  setCustomFixedSize,
  setEventWithInterval,
  setTranistion,
} from "./utils/SetStyles";
import { useTransform } from "./utils/SetTransform";
import { DragMouseTouchEvent, MoveEvent, OnLeaveEvent } from "../../index";
import { CoreConfig, DragStartEventData } from ".";
import useEmitEvents from "./utils/events/emitEvents";
import { DRAG_EVENT, draggableTargetTimingFunction, START_DRAG_EVENT, START_DROP_EVENT } from "./utils";
import ConfigHandler, { DroppableConfig } from "./configHandler";
import { IsHTMLElement, isTouchEvent } from "./utils/touchDevice";
import { addTempChild, addTempChildOnInsert, removeTempChildrens } from "./utils/tempChildren";
import { DroppableConfigurator } from "./utils/droppableConfigurator";
import {
  addClass,
  containClass,
  getClassesList,
  getClassesSelector,
  removeClass,
  toggleClass,
} from "./utils/dom/classList";
import { DRAGGABLE_CLASS, DRAGGING_CLASS, DRAGGING_HANDLER_CLASS, DROPPABLE_CLASS, DROPPING_CLASS, GRAB_CLASS, GRABBING_CLASS, HANDLER_CLASS } from "./utils/classes";
import HandlerPublisher from "./HandlerPublisher";

const enum DraggingState {
  NOT_DRAGGING,
  START_DRAGGING,
  DRAGING,
  END_DRAGGING,
}
export default function useDraggable<T>(
  draggableElement: HTMLElement,
  index: number,
  config: CoreConfig<T>,
  parent: HTMLElement,
  handlerPublisher: HandlerPublisher
) {
  const {
    handlerSelector,
    isDraggable,
    droppableGroup,
    animationDuration,
    delayBeforeRemove,
    draggingClass,
    removingClass,
    onRemoveAtEvent,
    droppableClass,
    onDragStart,
  } = config;

  const droppableGroupClass = getClassesList(droppableGroup)
    .map((classGroup) => `droppable-group-${classGroup}`)
    .join(" ");
  let draggingState: DraggingState = DraggingState.NOT_DRAGGING;
  let windowScroll = {
    scrollX: 0,
    scrollY: 0,
  };
  let pagePosition = { pageX: 0, pageY: 0 };

  let delayTimeout: NodeJS.Timeout|undefined;
  const [ setTransform, updateTransformState ] = useTransform(
    draggableElement
  );
  const [
    emitEventToSiblings,
    emitRemoveEventToSiblings,
    emitInsertEventToSiblings,
    emitFinishRemoveEventToSiblings,
    toggleDraggingClass,
   ] = useEmitEvents<T>(
    config,
    index,
    parent,
    droppableGroupClass,
    handlerPublisher,
    ()=>(draggingState = DraggingState.NOT_DRAGGING)
  );
  const setDraggable = () => {
    addClass(draggableElement, DRAGGABLE_CLASS)
  };
  const addHandlerClass = (handlerElement:Element| HTMLElement) => {
    addClass(handlerElement, HANDLER_CLASS)
    handlerPublisher.addSubscriber(handlerElement)
  }
  const setHandlerStyles = () => {
    if (isDraggable(draggableElement)) {
      const handlerElement = draggableElement.querySelector(handlerSelector);
      if (handlerElement) {
        addHandlerClass(handlerElement)
      } else {
        addHandlerClass(draggableElement)
      }
    }
  };
  
  const setCssStyles = () => {
    AddCssStylesToElement(document.body, [
      `.${DRAGGABLE_CLASS}{touch-action:manipulation;user-select:none;box-sizing:border-box!important;-webkit-user-select:none;}`,
      `.${HANDLER_CLASS}{pointer-events:auto!important;}`,
      `.${GRAB_CLASS}{cursor:grab;}`,
      ".temp-child{touch-action:none;pointer-events:none;box-sizing:border-box!important;}",
      `.droppable{box-sizing:border-box!important;}`,
      `.${DRAGGING_CLASS}{position:fixed;z-index:5000;width:var(--fixedWidth)!important;height:var(--fixedHeight)!important;}`,
      `.${DRAGGING_HANDLER_CLASS}{pointer-events:none!important;}`,
      `.${DROPPING_CLASS}{pointer-events:none!important;}`,
      `.${GRABBING_CLASS}{cursor:grabbing;}`,
      `.disable-transition{transition:none!important;}`,
    ]);
    setHandlerStyles();
    setDraggable();
  };
  const getHandler = (element: HTMLElement | undefined) => {
    const handler = element?.querySelector(`.${HANDLER_CLASS}`)
    const handlerParent = handler?.parentElement
    if (handler && handlerParent 
        && containClass(handlerParent, DROPPABLE_CLASS)
        && !handlerParent.isSameNode(parent)) {
      return null
    }
    return handler
  }
  const setSlotRefElementParams = (element: HTMLElement) => {
    const handlerElement = (getHandler(element) ?? element) as HTMLElement;
    if (handlerElement && isDraggable(element)) {
      assignDraggingEvent(
        handlerElement,
        "onmousedown",
        onmousedown("mousemove", "mouseup")
      );
      assignDraggingEvent(
        handlerElement,
        "ontouchstart",
        onmousedown("touchmove", "touchend")
      );
      disableMousedownEventFromImages(handlerElement);
    }
    if (!element?.isSameNode(handlerElement)) {
      assignDraggingEvent(element, "onmousedown", mousedownOnDraggablefunction);
    }
    addClass(parent, DROPPABLE_CLASS)
  };
  const disableMousedownEventFromImages = (handlerElement: Element) => {
    // Avoid dragging inner images
    const images = handlerElement.querySelectorAll("img");
    Array.from(images).forEach((image) => {
      image.onmousedown = () => false;
    });
  }
  const setTransformDragEvent = () => {
    if (pagePosition.pageX == 0 && pagePosition.pageY == 0) {
      return;
    }
    if (!droppableConfigurator.current) {
      return;
    }
    const { droppable, config } = droppableConfigurator.current;
    setTransform(draggableElement, droppable, pagePosition, config.direction);
    emitEventToSiblings(
      draggableElement,
      DRAG_EVENT,
      windowScroll,
      droppableConfigurator.current
    );
  };
  const changeDroppable = (
    newdDroppableConfig: DroppableConfig<T> | undefined,
    oldDroppableConfig: DroppableConfig<T> | undefined
  ) => {
    if (
      oldDroppableConfig &&
      draggingState == DraggingState.DRAGING &&
      !newdDroppableConfig?.droppable.isSameNode(oldDroppableConfig.droppable)
    ) {
      emitEventToSiblings(
        draggableElement,
        DRAG_EVENT,
        windowScroll,
        oldDroppableConfig
      );
    }
  };
  const droppableConfigurator =  
    new DroppableConfigurator(
      draggableElement, 
      droppableGroupClass, 
      parent, 
      setTransformDragEvent, 
      changeDroppable
    );
  
  const toggleDroppableClass = (isOutside:boolean) =>{
    if (!droppableConfigurator.current) {
      return
    }
    const droppables = droppableGroupClass? Array.from(
      document.querySelectorAll(getClassesSelector(droppableGroupClass))
    ):[parent];
    for (const droppable of droppables) {
        droppable
          .classList
            .toggle(droppableClass, 
                    !isOutside && droppable.isSameNode(droppableConfigurator.current.droppable))
    }
  }
  const onmousemove =  (event: DragMouseTouchEvent) => {
    droppableConfigurator.updateConfig(event);
    const isOutside = droppableConfigurator.isOutside(event)
    toggleDroppableClass(isOutside)
    if (draggingState === DraggingState.START_DRAGGING) {
      startDragging(event);
    } else if (draggingState === DraggingState.DRAGING) {
      updateTempChildren(isOutside);
      setTransformEvent(event);
    }
  };
  const updateTempChildren = (isOutside: boolean = true) => {
    if (!droppableConfigurator.current) {
      return;
    }
    const { droppable } = droppableConfigurator.current;
    removeTempChildrens(
      droppable,
      parent,
      droppableGroupClass,
      animationDuration,
      isOutside
    );
    if (isOutside) {
      return
    }
    addTempChild(
      draggableElement,
      parent,
      draggingState == DraggingState.START_DRAGGING,
      droppableConfigurator.current
    );
  };
  const handlerMousemove = (event: MouseEvent | TouchEvent) => {
    if (isTouchEvent(event) && event.cancelable) {
      event.preventDefault();
    } else if (isTouchEvent(event)) {
      return;
    }
    const eventToDragMouse = convetEventToDragMouseTouchEvent(event);
    onmousemove(eventToDragMouse);
  };
  const addTouchDeviceDelay = (event: MoveEvent, callback: () => void) => {
    if (event == "touchmove") {
      delayTimeout = setTimeout(() => {
        callback();
      }, 200);
    } else {
      callback();
    }
  };
  const clickOnChildDraggable = (event: DragMouseTouchEvent, element: HTMLElement | undefined) =>{
    const {clientX, clientY} = event
    const elementBelow = document.elementFromPoint(clientX, clientY)
    const draggableAncestor = elementBelow?.closest(`.${DRAGGABLE_CLASS}`)

    return elementBelow && element && draggableAncestor && !element.isSameNode(draggableAncestor)
  }
  const getDragStartEventData = (element: Element) : DragStartEventData<T>|undefined => {
    const value = config.onGetValue(index)
    return ({ index, element, value})
  }
  const onmousedown = (moveEvent: MoveEvent, onLeaveEvent: OnLeaveEvent) => {
    return (event: DragMouseTouchEvent) => {
      if (clickOnChildDraggable(event, draggableElement)){
        return
      }
      ConfigHandler.updateScrolls(parent, droppableGroupClass);
      const { scrollX, scrollY } = window;
      windowScroll = { scrollX, scrollY };
      if (draggingState === DraggingState.NOT_DRAGGING) {
        draggingState = DraggingState.START_DRAGGING;
        const data = getDragStartEventData(draggableElement)
        data && onDragStart(data)
        addTouchDeviceDelay(moveEvent, () => {
          if (moveEvent == 'touchmove') {
            droppableConfigurator.updateConfig(event);
            toggleDroppableClass(droppableConfigurator.isOutside(event))
            startDragging(event)
          }
          document.addEventListener(moveEvent, handlerMousemove, {
            passive: false,
          });
        });
        makeScrollEventOnDroppable(parent);
        document.addEventListener(onLeaveEvent, onLeave(moveEvent), {
          once: true,
        });
      }
    };
  };
  const mousedownOnDraggablefunction = (event: DragMouseTouchEvent) => {
    return droppableConfigurator.updateConfig(event);
  }
  const onLeave = (moveEvent: MoveEvent) => {
    return (event: MouseEvent | TouchEvent) => {
      toggleDroppableClass(true);
      const convertedEvent = convetEventToDragMouseTouchEvent(event);
      clearTimeout(delayTimeout);
      onDropDraggingEvent(droppableConfigurator.isOutside(convertedEvent, false));
      document.removeEventListener(moveEvent, handlerMousemove);
      droppableConfigurator.updateConfig(convertedEvent);
      const currentConfig = droppableConfigurator.getCurrentConfig(convertedEvent);
      if (currentConfig) {
        const { droppable } = currentConfig;
        removeOnScrollEvents(droppable);
      }
      parent.onscroll = null;
    };
  };
  const removeOnScrollEvents = (droppable: HTMLElement) => {
    droppable.onscroll = null;
    if (!droppableGroupClass) {
      return;
    }
    const droppables = Array.from(
      document.querySelectorAll(getClassesSelector(droppableGroupClass))
    );
    for (const droppable of droppables) {
      if (IsHTMLElement(droppable)) {
        droppable.onscroll = null;
      }
    }
  };
  const startDragging = (event: DragMouseTouchEvent) => {
    addTempChild(
      draggableElement,
      parent,
      draggingState == DraggingState.START_DRAGGING,
      droppableConfigurator.current
    );
    updateDraggingStateBeforeDragging();
    emitEventToSiblings(
      draggableElement,
      START_DRAG_EVENT,
      windowScroll,
      droppableConfigurator.current
    );
    setDraggingStyles(draggableElement);
    updateTransformState(event, draggableElement);
  };
  const updateDraggingStateBeforeDragging = () => {
    draggingState = DraggingState.DRAGING;
  };
  const setTransformEvent = (event: DragMouseTouchEvent) => {
    const { pageX, pageY } = event;
    pagePosition = { pageX, pageY };
    setTransformDragEvent();
  };
  const makeScrollEventOnDroppable = (droppable: Element) => {
    return setEventWithInterval(droppable, "onscroll", onScrollEvent);
  };
  const onScrollEvent = () => {
    return setTransformDragEvent();
  };
  const onDropDraggingEvent = (isOutsideAllDroppables: boolean) => {
    if (draggingState !== DraggingState.DRAGING) {
      draggingState = DraggingState.NOT_DRAGGING;
      return;
    }
    draggingState = DraggingState.END_DRAGGING;

    removeDraggingStyles(draggableElement);
    
    emitEventToSiblings(
      draggableElement,
      START_DROP_EVENT,
      windowScroll,
      isOutsideAllDroppables? 
        droppableConfigurator.initial: 
        droppableConfigurator.current,
      index
    );
  };
  const removeDraggingStyles = (element: Element) => {
    setTranistion(element, animationDuration, draggableTargetTimingFunction);
    moveTranslate(element, 0, 0);
  };
  const setDraggingStyles = (element: HTMLElement) => {
    const { height, width } = element.getBoundingClientRect();
    setCustomFixedSize(element, {
      fixedHeight: `${height}px`,
      fixedWidth: `${width}px`
    })
    toggleDraggingClass(element, true);
    toggleClass(element, draggingClass, true)
    element.style.transition = "";
  };

  const removeAtFromElement =(targetIndex: number) => {
    if (!droppableConfigurator.current) {
      return;
    }
    const config = droppableConfigurator.current as DroppableConfig<T>;

    if (targetIndex == index) {
      addClass(draggableElement, removingClass)
      setTimeout(() => {
        onRemoveAtEvent(index);
        removeClass(draggableElement, removingClass)
        addTempChild(
          draggableElement,
          parent,
          draggingState == DraggingState.START_DRAGGING,
          droppableConfigurator.current
        );
        emitRemoveEventToSiblings(
          targetIndex,
          draggableElement,
          config,
          (sibling: HTMLElement) => {
            removeDraggingStyles(sibling);
            emitFinishRemoveEventToSiblings(draggableElement);
          }
        );
      }, delayBeforeRemove);
    }
  }
  const insertAtFromElement = (targetIndex: number, value: T) => {
    if (targetIndex === index || targetIndex === config.onGetLegth() && index === targetIndex-1) {
      emitInsertEventToSiblings(targetIndex, draggableElement, parent, value,
         () => {
          addTempChildOnInsert(
            draggableElement,
            draggingState == DraggingState.START_DRAGGING,
            droppableConfigurator.initial
          );
        }
      )
    }
  }
  setCssStyles();
  setSlotRefElementParams(draggableElement);
  return [ removeAtFromElement, insertAtFromElement ] as const;
}

// TODO: use semantic-realese https://medium.comr/@davidkelley87/using-semantic-release-for-npm-libraries-with-github-actions-234461235fa7
//https://github.com/iamstevendao/vue-tel-input/blob/main/.github/workflows/deploy.yml
// TODO: add warning on docs with tranform animation