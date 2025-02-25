import { DroppableConfig } from "../composables/configHandler";
import { Translate } from "../../index";
import { Direction } from "../composables";
import { getPropByDirection } from "./GetStyles";
import { getGapPixels } from "./ParseStyles";
import { setTranistion } from "./SetStyles";
import { observeMutation } from "./observer";
// import { scrollByDirection } from "./scroll";
import getTranslationByDragging from "./translate/GetTranslationByDraggingAndEvent";
import { scrollPercent } from "./scroll";
import { DraggingState, TEMP_CHILD_CLASS } from ".";
import { getClassesSelector } from "./dom/classList";

const START_DRAG_EVENT = "startDrag";
const timingFunction = "cubic-bezier(0.2, 0, 0, 1)";
const getDistance = (
  droppable: HTMLElement,
  draggedElement: HTMLElement,
  direction: Direction
) => {
  let distances = getTranslationByDragging(
    draggedElement,
    START_DRAG_EVENT,
    direction,
    droppable
  );
  const gap = getGapPixels(droppable, direction);
  const { distance } = getPropByDirection(direction);
  distances[distance] -= gap;
  const { large, largeDistance } = getlarge(direction, draggedElement);
  distances[largeDistance] = large;
  return distances;
};
const getlarge = (direction: Direction, draggedElement: HTMLElement) => {
  const largeDirection = direction == "horizontal" ? "vertical" : "horizontal";
  const { distance } = getPropByDirection(largeDirection);
  return {
    large: draggedElement.getBoundingClientRect()[distance],
    largeDistance: distance,
  };
};
const setSizes = (element: HTMLElement, height: number, width: number) => {
  element.style.height = `${height}px`;
  element.style.width = `${width}px`;
  element.style.minWidth = `${width}px`;
};
const updateChildAfterCreated = (
  child: HTMLElement,
  droppable: HTMLElement,
  distances: Translate
) => {
  return (observer: MutationObserver) => {
    if (!droppable.contains(child)) {
      return;
    }
    setSizes(child, distances.height, distances.width);
    observer.disconnect();
  };
};
const fixScrollInitialChange = <T>(
  droppableConfig: DroppableConfig<T>,
  state: DraggingState
) => {
  if (state != DraggingState.START_DRAGGING) {
    return;
  }
  const { droppable, config, droppableScroll } = droppableConfig;
  const { direction } = config;

  const scrollCompleted =
    scrollPercent(config.direction, droppable, droppableScroll) > 0.99;
  const { scrollDistance, clientDistance, scrollElement } =
    getPropByDirection(direction);
  if (scrollCompleted) {
    droppable[scrollElement] =
      droppable[scrollDistance] - droppable[clientDistance];
  }
};
export const addTempChild = <T>(
  draggedElement: HTMLElement | undefined,
  parent: Element,
  state: DraggingState,
  droppableConfig?: DroppableConfig<T>,
  addingAnimationDuration?: number
) => {
  if (!droppableConfig) {
    return;
  }
  const { droppable, config } = droppableConfig;
  const { direction, animationDuration } = config;

  fixScrollInitialChange(droppableConfig, state);

  if (droppable.querySelector(`.${TEMP_CHILD_CLASS}`) || !draggedElement) {
    return;
  }

  var tempChildTag =
    draggedElement.tagName == "LI" ? "DIV" : draggedElement.tagName;
  var child = document.createElement(tempChildTag);
  child.classList.add(TEMP_CHILD_CLASS);
  setSizes(child, 0, 0);

  const distances = getDistance(droppable, draggedElement, direction);
  setTranistion(
    child,
    addingAnimationDuration??animationDuration,
    timingFunction,
    "width, min-width, height"
  );
  if (parent.isSameNode(droppable)) {
    setSizes(child, distances.height, distances.width);
  }
  observeMutation(
    updateChildAfterCreated(child, droppable, distances),
    droppable,
    {
      childList: true,
      subtree: true,
    }
  );
  droppable.appendChild(child);
};
export const addTempChildOnInsert = <T>(
  draggedElement: HTMLElement | undefined,
  state: DraggingState,
  droppableConfig?: DroppableConfig<T>
) => {
  if (!droppableConfig) {
    return;
  }
  const { droppable, config } = droppableConfig;
  const { direction, animationDuration } = config;

  fixScrollInitialChange(droppableConfig, state);

  if (droppable.querySelector(`.${TEMP_CHILD_CLASS}`) || !draggedElement) {
    return;
  }

  var tempChildTag =
    draggedElement.tagName == "LI" ? "DIV" : draggedElement.tagName;
  var child = document.createElement(tempChildTag);
  child.classList.add(TEMP_CHILD_CLASS);
  setSizes(child, 0, 0);

  const distances = getDistance(droppable, draggedElement, direction);
  setTranistion(
    child,
    animationDuration,
    timingFunction,
    "width, min-width, height"
  );
  droppable.appendChild(child);
  setSizeAfterAppendChild(child, distances)
};
function setSizeAfterAppendChild(child:HTMLElement, size: Translate){
  requestAnimationFrame(()=>{
    setSizes(child, size.height, size.width)
    requestAnimationFrame(()=>{
      setTranistion(
        child,
        0,
        timingFunction,
        "width, min-width, height"
      );
    })
  })
}
export const removeTempChildrens = (
  droppable: HTMLElement,
  parent: HTMLElement,
  droppableGroupClass: string | null,
  animationDuration: number,
  draggedElementIsOutside: boolean = true
) => {
  if (!droppableGroupClass) {
    return;
  }
  var children = document.querySelectorAll(
    `${getClassesSelector(droppableGroupClass)} > .${TEMP_CHILD_CLASS}`
  );

  children.forEach((tempChild) => {
    const childParent = tempChild.parentElement;
    if ( (childParent?.isSameNode(parent) || !draggedElementIsOutside &&childParent?.isSameNode(droppable))) {
      return;
    }
    const tempChildElement = tempChild as HTMLElement;
    setSizes(tempChildElement, 0, 0);
    setTimeout(() => {
      tempChild.parentNode?.removeChild(tempChild);
    }, animationDuration);
  });
};

export const removeTempChild = (
  parent: HTMLElement,
  animationDuration: number,
  isAnimated: boolean = false
) => {
  var lastChildren = parent.querySelectorAll(`.${TEMP_CHILD_CLASS}`);
  lastChildren.forEach((lastChild) => {
    const tempChildElement = lastChild as HTMLElement;
    if (isAnimated) {
      setSizes(tempChildElement, 0, 0);
      setTimeout(() => {
        if (parent.contains(lastChild)) {
          parent.removeChild(lastChild);
        }
      }, animationDuration);
    } else {
      parent.removeChild(lastChild);
    }
  });
};
