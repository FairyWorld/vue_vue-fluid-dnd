import { DroppableConfig } from './config/configHandler';
import { ElementScroll, Translate } from '../../index';
import { CoreConfig, Direction, HORIZONTAL, VERTICAL } from '.';
import {
	getDistanceValue,
	getPropByDirection,
	getRect,
	getScrollElementValue,
	isSameNode
} from './utils/GetStyles';
import { getGapPixels } from './utils/ParseStyles';
import { setSizeStyles, setTranistion } from './utils/SetStyles';
import { observeMutation } from './utils/observer';
import getTranslationByDragging from './events/dragAndDrop/getTranslationByDraggingAndEvent';
import { NONE_TRANSLATE, TEMP_CHILD_CLASS } from './utils';
import { addClass, getClassesSelector } from './utils/dom/classList';

const START_DRAG_EVENT = 'startDrag';
const timingFunction = 'cubic-bezier(0.2, 0, 0, 1)';
const DELAY_TIME = 50;
const TRANSITION_PROPERTY = 'width, min-width, height';

const getDistance = (droppable: HTMLElement, draggedElement: HTMLElement, direction: Direction) => {
	let distances = getTranslationByDragging(draggedElement, START_DRAG_EVENT, direction, droppable);
	const gap = getGapPixels(droppable, direction);
	const [, distance] = getDistanceValue(direction, distances);
	distances[distance] -= gap;
	const [large, largeDistance] = getlarge(direction, draggedElement);
	distances[largeDistance] = large;
	return distances;
};
const getlarge = (direction: Direction, draggedElement: HTMLElement) => {
	const largeDirection = direction == HORIZONTAL ? VERTICAL : HORIZONTAL;
	const distanceValue = getDistanceValue(largeDirection, getRect(draggedElement));
	return distanceValue;
};
const setSizes = (element: HTMLElement, translate: Translate = NONE_TRANSLATE) => {
	setSizeStyles(element, translate);
	element.style.minWidth = `${translate.width}px`;
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
		setSizes(child, distances);
		observer.disconnect();
	};
};
const overflowScroll = (droppable: HTMLElement, direction: Direction) => {
	const { scrollDistance, clientDistance } = getPropByDirection(direction);
	return droppable[scrollDistance] - droppable[clientDistance];
};
const scrollPercent = (
	direction: Direction,
	droppable: HTMLElement,
	droppableScroll: ElementScroll
) => {
	const [scrollElementValue] = getScrollElementValue(direction, droppableScroll);
	return scrollElementValue / overflowScroll(droppable, direction);
};
const fixScrollInitialChange = <T>(
	droppable: HTMLElement,
	config: CoreConfig<T>,
	scroll: ElementScroll,
	ifStartDragging: boolean
) => {
	if (!ifStartDragging) {
		return;
	}
	const { direction } = config;

	const scrollCompleted = scrollPercent(direction, droppable, scroll) > 0.99;
	const [, scrollElement] = getScrollElementValue(direction, droppable);

	if (scrollCompleted) {
		droppable[scrollElement] = overflowScroll(droppable, direction);
	}
};
const getTempChild = <T>(
	draggedElement: HTMLElement | undefined,
	ifStartDragging: boolean,
	droppableConfig: DroppableConfig<T>,
	addingAnimationDuration?: number
) => {
	const { droppable, config, scroll } = droppableConfig;
	const { direction, animationDuration } = config;

	fixScrollInitialChange(droppable, config, scroll, ifStartDragging);

	if (droppable.querySelector(`.${TEMP_CHILD_CLASS}`) || !draggedElement) {
		return;
	}

	var tempChildTag = draggedElement.tagName == 'LI' ? 'DIV' : draggedElement.tagName;
	var child = document.createElement(tempChildTag);
	addClass(child, TEMP_CHILD_CLASS);
	setSizes(child);
	const distances = getDistance(droppable, draggedElement, direction);
	setTranistion(
		child,
		addingAnimationDuration ?? animationDuration,
		timingFunction,
		TRANSITION_PROPERTY
	);
	return [child, distances, droppable] as const;
};
export const addTempChild = <T>(
	draggedElement: HTMLElement | undefined,
	parent: Element,
	ifStartDragging: boolean,
	droppableConfig: DroppableConfig<T>,
	addingAnimationDuration?: number
) => {
	const result = getTempChild(
		draggedElement,
		ifStartDragging,
		droppableConfig,
		addingAnimationDuration
	);
	if (!result) {
		return;
	}
	const [child, distances, droppable] = result;
	if (isSameNode(parent, droppable)) {
		setSizes(child, distances);
	}
	observeMutation(updateChildAfterCreated(child, droppable, distances), droppable, {
		childList: true,
		subtree: true
	});
	droppable.appendChild(child);
};
export const addTempChildOnInsert = <T>(
	draggedElement: HTMLElement | undefined,
	ifStartDragging: boolean,
	droppableConfig: DroppableConfig<T>
) => {
	const result = getTempChild(draggedElement, ifStartDragging, droppableConfig);
	if (!result) {
		return;
	}
	const [child, distances, droppable] = result;
	droppable.appendChild(child);
	setSizeAfterAppendChild(child, distances);
};
const setSizeAfterAppendChild = (child: HTMLElement, size: Translate) => {
	return requestAnimationFrame(() => {
		setSizes(child, size);
		requestAnimationFrame(() => {
			setTranistion(child, 0, timingFunction, TRANSITION_PROPERTY);
		});
	});
};
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
		if (
			isSameNode(parent, childParent) ||
			(!draggedElementIsOutside && isSameNode(droppable, childParent))
		) {
			return;
		}
		const tempChildElement = tempChild as HTMLElement;
		setSizes(tempChildElement);
		setTimeout(() => {
			tempChild.parentNode?.removeChild(tempChild);
		}, animationDuration + DELAY_TIME);
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
			setSizes(tempChildElement);
			setTimeout(() => {
				if (parent.contains(tempChildElement)) {
					parent.removeChild(tempChildElement);
				}
			}, animationDuration + DELAY_TIME);
		} else {
			parent.removeChild(lastChild);
		}
	});
};
