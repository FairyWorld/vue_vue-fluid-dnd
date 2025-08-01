import {
	draggableIsOutside,
	getAxisValue,
	getBefore,
	getDistanceValue,
	getRect,
	getSiblings,
	getTransform,
	getWindowScroll,
	isSameNode
} from '../../utils/GetStyles';
import { ElementScroll, Translate, WindowScroll } from '../../../../index';
import { moveTranslate, removeTranslateWhitoutTransition } from '../../utils/SetStyles';
import { CoreConfig, Direction } from '../..';
import getTranslationByDragging from './getTranslationByDraggingAndEvent';
import getTranslateBeforeDropping from './getTranslateBeforeDropping';
import {
	DRAG_EVENT,
	NONE_TRANSLATE,
	START_DRAG_EVENT,
	START_DROP_EVENT,
	TEMP_CHILD_CLASS
} from '../../utils';
import { DroppableConfig } from '../../config/configHandler';
import { IsHTMLElement } from '../../utils/typesCheckers';
import { removeTempChild } from '../../tempChildren';
import { DRAGGABLE_CLASS, DROPPING_CLASS } from '../../utils/classes';
import { addClass, containClass, getClassesSelector, removeClass } from '../../utils/dom/classList';
import HandlerPublisher from '../../HandlerPublisher';
import { useChangeDraggableStyles } from '../changeDraggableStyles';
const DELAY_TIME_TO_SWAP = 50;

type DraggingEvent = typeof DRAG_EVENT | typeof START_DRAG_EVENT;
type DropEvent = 'drop' | typeof START_DROP_EVENT;

export default function useDragAndDropEvents<T>(
	currentConfig: CoreConfig<T>,
	index: number,
	parent: HTMLElement,
	droppableGroupClass: string | null,
	handlerPublisher: HandlerPublisher,
	endDraggingAction: () => void
) {
	let actualIndex = index;
	const { onRemoveAtEvent, animationDuration, draggingClass } = currentConfig;

	const [removeElementDraggingStyles, toggleDraggingClass, dragEventOverElement] =
		useChangeDraggableStyles(currentConfig, handlerPublisher, endDraggingAction);

	const emitDraggingEvent = (
		draggedElement: HTMLElement,
		event: DraggingEvent,
		droppable: HTMLElement,
		config: CoreConfig<T>
	) => {
		const tranlation = getTranslationByDragging(draggedElement, event, config.direction, droppable);
		emitDraggingEventToSiblings(draggedElement, event, tranlation, droppable, config);
	};
	const emitDroppingEvent = (
		draggedElement: HTMLElement,
		event: DropEvent,
		droppableConfig: DroppableConfig<T> | undefined,
		initialWindowScroll: WindowScroll,
		positionOnSourceDroppable?: number
	) => {
		if (!droppableConfig) {
			return;
		}
		const { droppable, scroll, config } = droppableConfig;
		const tranlation = getTranslationByDragging(draggedElement, event, config.direction, droppable);
		emitDroppingEventToSiblings(
			draggedElement,
			event,
			tranlation,
			initialWindowScroll,
			droppable,
			scroll,
			config,
			positionOnSourceDroppable
		);
	};
	// #region Drag events
	const emitDraggingEventToSiblings = (
		draggedElement: HTMLElement,
		event: DraggingEvent,
		translation: Translate,
		droppable: HTMLElement,
		config: CoreConfig<T>
	) => {
		const [siblings] = getSiblings(draggedElement, droppable);
		const isOutside = draggableIsOutside(draggedElement, droppable);
		const { direction, onDragOver } = config;
		onDragOver({
			element: draggedElement,
			index,
			targetIndex: actualIndex,
			value: currentConfig.onGetValue(index),
			droppable
		});
		if (siblings.length == 0) {
			updateActualIndexBaseOnTranslation(translation, 1, direction, siblings);
		}
		for (const [index, sibling] of siblings.entries()) {
			if (!containClass(sibling, DRAGGABLE_CLASS)) {
				continue;
			}
			const siblingTransition = canChangeDraggable(direction, draggedElement, sibling, translation);
			if (!isOutside && siblingTransition) {
				translation = siblingTransition;
			} else if (!isOutside) {
				continue;
			}
			const siblingRealIndex = siblings.length - index;
			updateActualIndexBaseOnTranslation(translation, siblingRealIndex, direction, siblings);
			if (event === START_DRAG_EVENT) {
				moveTranslate(sibling, translation);
			} else if (event === DRAG_EVENT) {
				dragEventOverElement(sibling, translation);
			}
		}
	};
	const canChangeDraggable = (
		direction: Direction,
		sourceElement: Element,
		targetElement: Element,
		translation: Translate
	) => {
		const currentBoundingClientRect = getRect(sourceElement);
		const targetBoundingClientRect = getRect(targetElement);

		const currentPosition = getBefore(direction, currentBoundingClientRect);

		const targetPosition = getBefore(direction, targetBoundingClientRect);
		const [targetSize] = getDistanceValue(direction, targetBoundingClientRect);
		const targetMiddle = targetPosition + targetSize / 2;

		const targetTransform = getAxisValue(direction, getTransform(targetElement));
		const targetMiddleWithoutTransform = targetMiddle - targetTransform;

		if (currentPosition > targetMiddleWithoutTransform) {
			return NONE_TRANSLATE;
		}
		return translation;
	};
	const updateActualIndexBaseOnTranslation = (
		translation: Translate,
		siblingIndex: number,
		direction: Direction,
		siblings: Element[]
	) => {
		const itemsCount = siblings.filter((sibling) => containClass(sibling, DRAGGABLE_CLASS)).length;

		const [distance] = getDistanceValue(direction, translation);
		if (distance == 0) {
			actualIndex = Math.max(actualIndex, siblingIndex);
		} else {
			actualIndex = Math.min(actualIndex, siblingIndex - 1);
		}
		actualIndex = Math.min(actualIndex, itemsCount);
	};
	// #region Drop events
	const emitDroppingEventToSiblings = (
		draggedElement: HTMLElement,
		event: DropEvent,
		translation: Translate,
		initialWindowScroll: WindowScroll,
		droppable: HTMLElement,
		scroll: ElementScroll,
		config: CoreConfig<T>,
		positionOnSourceDroppable?: number
	) => {
		const [siblings, positionOnDroppable] = getSiblings(draggedElement, droppable);
		const allSiblings = siblings.toReversed();
		const realPositionOnDroppable =
			positionOnDroppable === -1 ? allSiblings.length : positionOnDroppable;

		allSiblings.splice(realPositionOnDroppable, 0, draggedElement);

		const [previousElement, nextElement, targetIndex] = getPreviousAndNextElement(
			draggedElement,
			positionOnDroppable,
			allSiblings,
			droppable
		);
		translation = getTranslationByDragging(
			draggedElement,
			event,
			config.direction,
			parent,
			previousElement,
			nextElement
		);
		const windowScroll = getWindowScroll();
		const draggableTranslation = getTranslateBeforeDropping(
			config.direction,
			allSiblings,
			positionOnDroppable,
			targetIndex,
			windowScroll,
			scroll,
			initialWindowScroll,
			droppable,
			draggedElement
		);
		if (siblings.length == 0) {
			startDropEventOverElement(undefined, translation, draggedElement, draggableTranslation);
		}

		for (const [index, sibling] of siblings.toReversed().entries()) {
			let newTranslation = translation;
			if (targetIndex - 1 >= index) {
				newTranslation = NONE_TRANSLATE;
			}
			if (event === START_DROP_EVENT && !containClass(sibling, TEMP_CHILD_CLASS)) {
				startDropEventOverElement(sibling, newTranslation, draggedElement, draggableTranslation);
			}
		}
		dropEventOverElement(targetIndex, draggedElement, config, droppable, positionOnSourceDroppable);
	};
	const getPreviousAndNextElement = (
		draggedElement: HTMLElement,
		elementPosition: number,
		allSiblings: Element[],
		droppable: HTMLElement
	) => {
		const isOutside = draggableIsOutside(draggedElement, droppable);

		const targetIndex = isOutside ? elementPosition : actualIndex;

		const getPreviousAndNextElementIndex = () => {
			if (elementPosition < targetIndex) {
				return [targetIndex, targetIndex + 1];
			} else if (elementPosition > targetIndex) {
				return [targetIndex - 1, targetIndex];
			} else {
				return [targetIndex - 1, targetIndex + 1];
			}
		};
		const [previousIndex, nextIndex] = getPreviousAndNextElementIndex();
		const previousElement = allSiblings[previousIndex] ?? null;
		const nextElement = allSiblings[nextIndex] ?? null;
		return [previousElement, nextElement, targetIndex] as const;
	};
	const startDropEventOverElement = (
		targetElement: Element | undefined,
		translation: Translate,
		element: HTMLElement,
		sourceElementTranlation: Translate
	) => {
		moveTranslate(targetElement, translation);
		moveTranslate(element, sourceElementTranlation);
	};
	const dropEventOverElement = (
		targetIndex: number,
		element: HTMLElement,
		config: CoreConfig<T>,
		droppable: HTMLElement,
		positionOnSourceDroppable?: number
	) => {
		const { onInsertEvent, onDragEnd } = config;
		addClass(element, DROPPING_CLASS);
		removeStytes(element, parent, droppable, () => {
			removeClass(element, DROPPING_CLASS);
			if (positionOnSourceDroppable != undefined) {
				const value = onRemoveAtEvent(positionOnSourceDroppable, true);
				if (value != undefined) {
					onInsertEvent(targetIndex, value, true);
					onDragEnd({ value, index: targetIndex });
				}
				manageDraggingClass(element);
				clearExcessTranslateStyles();
			}
		});
	};
	const clearExcessTranslateStyles = () => {
		if (!droppableGroupClass) {
			return;
		}
		var children = document.querySelectorAll(
			`${getClassesSelector(droppableGroupClass)} > .${DRAGGABLE_CLASS}`
		);
		for (const element of children) {
			removeTranslateWhitoutTransition(element);
		}
	};
	const manageDraggingClass = (element: HTMLElement) => {
		setTimeout(() => {
			removeClass(element, draggingClass);
		}, DELAY_TIME_TO_SWAP);
	};
	const removeStytes = (
		element: HTMLElement,
		parent: HTMLElement,
		droppable: HTMLElement,
		func?: () => void
	) => {
		setTimeout(() => {
			func && func();
			removeTempChildOnDroppables(parent, droppable);
			reduceTempchildSize(droppable);
			removeElementDraggingStyles(element);
			removeTranslateFromSiblings(element, parent);
			removeTranslateFromSiblings(element, droppable);
		}, animationDuration);
	};
	const removeTempChildOnDroppables = (parent: HTMLElement, droppable: HTMLElement) => {
		if (isSameNode(parent, droppable)) {
			removeTempChild(parent, animationDuration);
		} else {
			removeTempChild(parent, animationDuration, true);
			removeTempChild(droppable, animationDuration);
		}
	};
	const reduceTempchildSize = (droppable: HTMLElement) => {
		if (isSameNode(parent, droppable)) {
			return;
		}
		var [lastChildren] = parent.querySelectorAll(`.${TEMP_CHILD_CLASS}`);
		if (!lastChildren) {
			return;
		}
		if (IsHTMLElement(lastChildren)) {
			lastChildren.style.height = '0px';
			lastChildren.style.width = '0px';
		}
	};
	const removeTranslateFromSiblings = (element: HTMLElement, parent: HTMLElement) => {
		const [siblings] = getSiblings(element, parent);
		for (const sibling of [...siblings, element]) {
			removeTranslateWhitoutTransition(sibling);
		}
	};

	return [emitDraggingEvent, emitDroppingEvent, toggleDraggingClass] as const;
}
