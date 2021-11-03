import {
	forwardRef,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from 'react';
import {
	createDescendantContext,
	DescendantProvider,
	useDescendant,
	useDescendants,
	useDescendantsInit,
} from '@react-lit/descendants';
import { useId } from '@react-lit/auto-id';
import { Popover, positionMatchWidth } from '@react-lit/popover';
import {
	useIsomorphicLayoutEffect as useLayoutEffect,
	createNamedContext,
	isFunction,
	makeId,
	noop,
	useComposeRefs,
	useUpdateEffect,
	useStatefulRefValue,
	composeEventHandlers,
} from '@react-lit/helper';
import { HighlightWords } from './highlight-words';

////////////////////////////////////////////////////////////////////////////////

/**
 * @enum {string}
 */
const State = {
	IDLE: 'idle',
	SUGGESTING: 'suggesting',
	NAVIGATING: 'navigating',
	INTERACTING: 'interacting',
};

/**
 * @enum {string}
 */
const Event = {
	CLEAR: 'clear',
	CHANGE: 'change',
	INITIAL_CHANGE: 'initial_change',
	NAVIGATE: 'navigate',
	SELECT_WITH_KEYBOARD: 'select_with_keyboard',
	SELECT_WITH_CLICK: 'select_with_click',
	ESCAPE: 'escape',
	BLUR: 'blur',
	INTERACT: 'interact',
	FOCUS: 'focus',
	OPEN_WITH_BUTTON: 'open_with_button',
	OPEN_WITH_INPUT_CLICK: 'open_with_input_click',
	CLOSE_WITH_BUTTON: 'close_with_button',
};

////////////////////////////////////////////////////////////////////////////////

const stateChart = {
	initial: State.IDLE,
	states: {
		[State.IDLE]: {
			on: {
				[Event.BLUR]: State.IDLE,
				[Event.CLEAR]: State.IDLE,
				[Event.CHANGE]: State.SUGGESTING,
				[Event.INITIAL_CHANGE]: State.IDLE,
				[Event.FOCUS]: State.SUGGESTING,
				[Event.NAVIGATE]: State.NAVIGATING,
				[Event.OPEN_WITH_BUTTON]: State.SUGGESTING,
				[Event.OPEN_WITH_INPUT_CLICK]: State.SUGGESTING,
			},
		},
		[State.SUGGESTING]: {
			on: {
				[Event.CHANGE]: State.SUGGESTING,
				[Event.FOCUS]: State.SUGGESTING,
				[Event.NAVIGATE]: State.NAVIGATING,
				[Event.CLEAR]: State.IDLE,
				[Event.ESCAPE]: State.IDLE,
				[Event.BLUR]: State.IDLE,
				[Event.SELECT_WITH_CLICK]: State.IDLE,
				[Event.INTERACT]: State.INTERACTING,
				[Event.CLOSE_WITH_BUTTON]: State.IDLE,
			},
		},
		[State.NAVIGATING]: {
			on: {
				[Event.CHANGE]: State.SUGGESTING,
				[Event.FOCUS]: State.SUGGESTING,
				[Event.CLEAR]: State.IDLE,
				[Event.BLUR]: State.IDLE,
				[Event.ESCAPE]: State.IDLE,
				[Event.NAVIGATE]: State.NAVIGATING,
				[Event.SELECT_WITH_CLICK]: State.IDLE,
				[Event.SELECT_WITH_KEYBOARD]: State.IDLE,
				[Event.CLOSE_WITH_BUTTON]: State.IDLE,
				[Event.INTERACT]: State.INTERACTING,
			},
		},
		[State.INTERACTING]: {
			on: {
				[Event.CLEAR]: State.IDLE,
				[Event.CHANGE]: State.SUGGESTING,
				[Event.FOCUS]: State.SUGGESTING,
				[Event.BLUR]: State.IDLE,
				[Event.ESCAPE]: State.IDLE,
				[Event.NAVIGATE]: State.NAVIGATING,
				[Event.CLOSE_WITH_BUTTON]: State.IDLE,
				[Event.SELECT_WITH_CLICK]: State.IDLE,
			},
		},
	},
};

////////////////////////////////////////////////////////////////////////////////

/**
 * @typedef {Object} StateData
 * @prop {Event} lastEventType
 * @prop {string | null} navigationValue
 * @prop {string | null} value
 */

/**
 * @typedef {Object} MachineEvent
 * @prop {Event} type
 * @prop {string} [value=]
 * @prop {boolean} [persistSelection=]
 */

/**
 * @param {StateData} data
 * @param {MachineEvent} event
 * @returns {StateData}
 */
const reducer = (data, event) => {
	let nextState = { ...data, lastEventType: event.type };
	switch (event.type) {
		case Event.CHANGE:
		case Event.INITIAL_CHANGE: {
			return {
				...nextState,
				navigationValue: null,
				value: event.value,
			};
		}

		case Event.NAVIGATE:
		case Event.OPEN_WITH_BUTTON:
		case Event.OPEN_WITH_INPUT_CLICK: {
			return {
				...nextState,
				// NOTE(joel): When we open a list, set the navigation value to the
				// value in the input, if it's in the list, then it'll automatically be
				// highlighted.
				navigationValue: findNavigationValue(nextState, event),
			};
		}

		case Event.CLEAR: {
			return {
				...nextState,
				value: '',
				navigationValue: null,
			};
		}

		case Event.BLUR:
		case Event.ESCAPE: {
			return {
				...nextState,
				navigationValue: null,
			};
		}

		case Event.SELECT_WITH_CLICK: {
			return {
				...nextState,
				value: event.value,
				navigationValue: null,
			};
		}

		case Event.SELECT_WITH_KEYBOARD: {
			return {
				...nextState,
				value: data.navigationValue,
				navigationValue: null,
			};
		}

		case Event.CLOSE_WITH_BUTTON: {
			return {
				...nextState,
				navigationValue: null,
			};
		}

		case Event.INTERACT: {
			return nextState;
		}

		case Event.FOCUS: {
			return {
				...nextState,
				// NOTE(joel):When we open a list, set the navigation value to the
				// value in the input, if it's in the list, then it'll automatically be
				// highlighted.
				navigationValue: findNavigationValue(nextState, event),
			};
		}

		default:
			return nextState;
	}
};

////////////////////////////////////////////////////////////////////////////////

/**
 * findNavigationValue
 * @param {StateData} stateData
 * @param {MachineEvent} event
 */
function findNavigationValue(stateData, event) {
	if (event.value) {
		return event.value;
	} else if (event.persistSelection) {
		return stateData.value;
	}
	return null;
}

////////////////////////////////////////////////////////////////////////////////

const ComboboxDescendantContext = createDescendantContext(
	'ComboboxDescendantContext',
);

const ComboboxContext = createNamedContext('ComboboxContext', {});

// NOTE(joel): We use a third context to be able to pass the input value down
// to `ComboboxOptionText` and it can work it's highlight text magic no matter
// what else is rendered around it.
const OptionContext = createNamedContext('OptionContext', {});

////////////////////////////////////////////////////////////////////////////////

/**
 * Combobox renders all context providers and a wrapper HTML element around
 * our comboxbox solution.
 */
export const Combobox = forwardRef(
	(
		{
			onSelect,
			openOnFocus = false,
			children,
			as: Comp = 'div',
			'aria-label': ariaLabel,
			'aria-labelledby': ariaLabelledby,
			...props
		},
		forwardedRef,
	) => {
		const [options, setOptions] = useDescendantsInit();

		const inputRef = useRef();
		const popoverRef = useRef();
		const buttonRef = useRef();

		// NOTE(joel): When `<ComboboxInput autocomplete={false} />` we don't want
		// to cycle back to the user's value when navigating but we need to know
		// it in `useKeyDown` which is far away from here, so we do something
		// sneaky and write it to this ref on context so we can use it anywhere
		// else.
		const autocompletePropRef = useRef(false);
		const persistSelectionRef = useRef(false);

		// NOTE(joel): The value the user has typed (value) and the value the user
		// has navigated to (navigationValue).
		const defaultData = { value: '', navigationValue: null };

		const [state, data, transition] = useReducerMachine(
			stateChart,
			reducer,
			defaultData,
		);

		useFocusManagement(data.lastEventType, inputRef);

		const id = useId(props.id);
		const listboxId = id ? makeId('listbox', id) : 'listbox';

		const context = {
			ariaLabel,
			ariaLabelledby,
			autocompletePropRef,
			buttonRef,
			comboboxId: id,
			data,
			inputRef,
			isExpanded: popoverIsExpanded(state),
			listboxId,
			onSelect: onSelect || noop,
			openOnFocus,
			persistSelectionRef,
			popoverRef,
			state,
			transition,
		};

		return (
			<DescendantProvider
				context={ComboboxDescendantContext}
				items={options}
				set={setOptions}
			>
				<ComboboxContext.Provider value={context}>
					<Comp {...props} data-state={state} ref={forwardedRef}>
						{isFunction(children)
							? children({
									id,
									isExpanded: popoverIsExpanded(state),
									navigationValue: data.navigationValue ?? null,
									state,
							  })
							: children}
					</Comp>
				</ComboboxContext.Provider>
			</DescendantProvider>
		);
	},
);

////////////////////////////////////////////////////////////////////////////////

/**
 * ComboboxInput wraps an `<input/>` with a couple extra props that work with
 * the combobox.
 */
export const ComboboxInput = forwardRef(
	(
		{
			as: Comp = 'input',
			selectOnClick = false,
			autocomplete = true,
			onClick,
			onChange,
			onKeyDown,
			onBlur,
			onFocus,
			value: controlledValue,
			...props
		},
		parentRef,
	) => {
		const { current: initialControlledValue } = useRef(controlledValue);
		const controlledValueChangedRef = useRef(false);
		useUpdateEffect(() => {
			controlledValueChangedRef.current = true;
		}, [controlledValue]);

		const {
			data: { navigationValue, value, lastEventType },
			inputRef,
			state,
			transition,
			listboxId,
			autocompletePropRef,
			openOnFocus,
			isExpanded,
			ariaLabel,
			ariaLabelledby,
			persistSelectionRef,
		} = useContext(ComboboxContext);

		const ref = useComposeRefs(inputRef, parentRef);

		// NOTE(joel): Because we close the List on blur, we need to track if the
		// blur is caused by clicking inside the list, and if so, don't close the
		// List.
		const selectOnClickRef = useRef(false);

		const handleKeyDown = useKeyDown();

		const handleBlur = useBlur();

		const isControlled = controlledValue != null;

		// NOTE(joel): Set the autocomplete flag in context so it can be used
		// by other components later on.
		// Layout effect should be SSR-safe here because we don't actually do
		// anything with this ref that involves rendering until after we've let the
		// client hydrate in nested components.
		useLayoutEffect(() => {
			autocompletePropRef.current = autocomplete;
		}, [autocomplete, autocompletePropRef]);

		let handleValueChange = useCallback(
			value => {
				if (value.trim() === '') {
					transition(Event.CLEAR);
				} else if (
					value === initialControlledValue &&
					!controlledValueChangedRef.current
				) {
					transition(Event.INITIAL_CHANGE, { value });
				} else {
					transition(Event.CHANGE, { value });
				}
			},
			[initialControlledValue, transition],
		);

		// NOTE(joel): If the value is controlled from outside we still need to do
		// our transitions, so we have this derived state to emulate `onChange` of
		// the input as we receive new `value`s and when controlled, we don't
		// trigger `handleValueChange` as the user types, instead the developer
		// controls it with the normal input `onChange` prop.
		useEffect(() => {
			if (
				isControlled &&
				controlledValue !== value &&
				(controlledValue.trim() === '' ? (value || '').trim() !== '' : true)
			) {
				handleValueChange(controlledValue);
			}
		}, [controlledValue, handleValueChange, isControlled, value]);

		/**
		 * handleChange
		 * @param {ChangeEvent<HTMLInputElement>} event
		 */
		function handleChange(event) {
			let { value } = event.target;
			if (!isControlled) {
				handleValueChange(value);
			}
		}

		/**
		 * handleFocus
		 */
		function handleFocus() {
			if (selectOnClick) {
				selectOnClickRef.current = true;
			}

			// NOTE(joel): If we select an option with click, `useFocusManagement`
			// will focus the input. In those cases we don't want to cause the menu
			// to open back up, so we guard behind these states.
			if (openOnFocus && lastEventType !== Event.SELECT_WITH_CLICK) {
				transition(Event.FOCUS, {
					persistSelection: persistSelectionRef.current,
				});
			}
		}

		/**
		 * handleClick
		 */
		function handleClick() {
			if (selectOnClickRef.current) {
				selectOnClickRef.current = false;
				inputRef.current?.select();
			}

			if (openOnFocus && state === State.IDLE) {
				transition(Event.OPEN_WITH_INPUT_CLICK);
			}
		}

		let inputValue =
			autocomplete &&
			(state === State.NAVIGATING || state === State.INTERACTING)
				? // NOTE(joel): When idle, we don't have a `navigationValue` on
				  // ArrowUp/ArrowDown
				  navigationValue || controlledValue || value
				: controlledValue || value;

		return (
			<Comp
				aria-activedescendant={
					navigationValue ? String(makeHash(navigationValue)) : undefined
				}
				aria-autocomplete="both"
				aria-controls={listboxId}
				aria-expanded={isExpanded}
				aria-haspopup="listbox"
				aria-label={ariaLabel}
				aria-labelledby={ariaLabel ? undefined : ariaLabelledby}
				role="combobox"
				{...props}
				data-state={state}
				ref={ref}
				onBlur={composeEventHandlers(onBlur, handleBlur)}
				onChange={composeEventHandlers(onChange, handleChange)}
				onClick={composeEventHandlers(onClick, handleClick)}
				onFocus={composeEventHandlers(onFocus, handleFocus)}
				onKeyDown={composeEventHandlers(onKeyDown, handleKeyDown)}
				value={inputValue || ''}
			/>
		);
	},
);

////////////////////////////////////////////////////////////////////////////////

/**
 * ComboboxPopover contains the popup that renders the list. Because some user
 * interfaces require to render more than the list itself in the popup, we
 * need to render this component around the list.
 */
export const ComboboxPopover = forwardRef(
	(
		{
			as: Comp = 'div',
			children,
			portal = true,
			onKeyDown,
			onBlur,
			position = positionMatchWidth,
			...props
		},
		parentRef,
	) => {
		const { popoverRef, inputRef, isExpanded, state } =
			useContext(ComboboxContext);
		const ref = useComposeRefs(popoverRef, parentRef);
		const handleKeyDown = useKeyDown();
		const handleBlur = useBlur();

		const sharedProps = {
			'data-state': state,
			onKeyDown: composeEventHandlers(onKeyDown, handleKeyDown),
			onBlur: composeEventHandlers(onBlur, handleBlur),
			// NOTE(joel): Instead of conditionally rendering the popover we use the
			// `hidden` prop because we don't want to unmount on close (from escape
			// or onSelect). However, the developer can conditionally render the
			// ComboboxPopover if they do want to cause mount/unmount based on the
			// app's own data (like results.length or whatever).
			hidden: !isExpanded,
			tabIndex: -1,
			children,
		};

		return portal ? (
			<Popover
				as={Comp}
				{...props}
				ref={ref}
				position={position}
				targetRef={inputRef}
				{...sharedProps}
			/>
		) : (
			<Comp ref={ref} {...props} {...sharedProps} />
		);
	},
);

////////////////////////////////////////////////////////////////////////////////

/**
 * ComboboxList contains the `ComboboxOption` elements and sets up the proper
 * aria attributes for the list.
 */
export const ComboboxList = forwardRef(
	(
		{
			// NOTE(joel): When true, and the list opens again, the option with a
			// matching value will be automatically highlighted.
			persistSelection = false,
			as: Comp = 'ul',
			style,
			...props
		},
		parentRef,
	) => {
		const { persistSelectionRef, listboxId } = useContext(ComboboxContext);

		if (persistSelection) {
			persistSelectionRef.current = true;
		}

		return (
			<Comp
				role="listbox"
				{...props}
				ref={parentRef}
				style={{
					margin: 0,
					padding: 0,
					listStyle: 'none',
					userSelect: 'none',
					...style,
				}}
				id={listboxId}
			/>
		);
	},
);

////////////////////////////////////////////////////////////////////////////////

/**
 * ComboboxOption renders an option that is suggested to the user as they
 * interact with the combobox.
 */
export const ComboboxOption = forwardRef(
	(
		{
			as: Comp = 'li',
			children,
			index: indexProp,
			value,
			onClick,
			style,
			...props
		},
		parentRef,
	) => {
		const {
			onSelect,
			data: { navigationValue },
			transition,
		} = useContext(ComboboxContext);

		const ownRef = useRef(null);

		const [element, handleRefSet] = useStatefulRefValue(ownRef, null);
		const descendant = useMemo(() => ({ element, value }), [value, element]);
		const index = useDescendant(
			descendant,
			ComboboxDescendantContext,
			indexProp,
		);

		const ref = useComposeRefs(parentRef, handleRefSet);

		const isActive = navigationValue === value;

		const handleClick = () => {
			onSelect && onSelect(value);
			transition(Event.SELECT_WITH_CLICK, { value });
		};

		return (
			<OptionContext.Provider value={{ value, index }}>
				<Comp
					aria-selected={isActive}
					role="option"
					{...props}
					style={{ cursor: 'pointer', ...style }}
					ref={ref}
					id={String(makeHash(value))}
					data-highlighted={isActive ? '' : undefined}
					// NOTE(joel): Without a negative `tabIndex` the menu will close from
					// `onBlur`, but with it the element can be `document.activeElement`
					// and then our focus checks in `onBlur` will work as intended.
					tabIndex={-1}
					onClick={composeEventHandlers(onClick, handleClick)}
				>
					{children ? (
						isFunction(children) ? (
							children({ value, index })
						) : (
							children
						)
					) : (
						<ComboboxOptionText />
					)}
				</Comp>
			</OptionContext.Provider>
		);
	},
);

////////////////////////////////////////////////////////////////////////////////

/**
 * ComboboxOptionText renders the value of a `ComboboxOption` as text but with
 * <span />'s wrapping the matching and non-matching segments of text.
 * We don't `forwardRef` or spread props because we render multiple spans or
 * null here.
 */
export function ComboboxOptionText() {
	const { value } = useContext(OptionContext);
	const {
		data: { value: contextValue },
	} = useContext(ComboboxContext);

	const results = useMemo(
		() =>
			HighlightWords.findAll({
				searchWords: escapeRegexp(contextValue || '').split(/\s+/),
				textToHighlight: value,
			}),
		[contextValue, value],
	);

	return (
		<>
			{results.length
				? results.map((result, index) => {
						let str = value.slice(result.start, result.end);
						return (
							<span
								key={index}
								data-user-value={result.highlight ? true : undefined}
								data-suggested-value={result.highlight ? undefined : true}
							>
								{str}
							</span>
						);
				  })
				: value}
		</>
	);
}

////////////////////////////////////////////////////////////////////////////////

/**
 * ComboboxButton renders a button that can open/close the list of options.
 */
export const ComboboxButton = forwardRef(
	({ as: Comp = 'button', onClick, onKeyDown, ...props }, parentRef) => {
		const { transition, state, buttonRef, listboxId, isExpanded } =
			useContext(ComboboxContext);
		const ref = useComposeRefs(buttonRef, parentRef);

		const handleKeyDown = useKeyDown();

		const handleClick = () => {
			if (state === State.IDLE) {
				transition(Event.OPEN_WITH_BUTTON);
			} else {
				transition(Event.CLOSE_WITH_BUTTON);
			}
		};

		return (
			<Comp
				aria-controls={listboxId}
				aria-haspopup="listbox"
				aria-expanded={isExpanded}
				{...props}
				ref={ref}
				onClick={composeEventHandlers(onClick, handleClick)}
				onKeyDown={composeEventHandlers(onKeyDown, handleKeyDown)}
			/>
		);
	},
);

////////////////////////////////////////////////////////////////////////////////

/**
 * popoverIsExpanded tests if the given state suggests if the popover is
 * expanded or not.
 * @param {State} state
 * @returns {boolean}
 */
function popoverIsExpanded(state) {
	return [State.SUGGESTING, State.NAVIGATING, State.INTERACTING].includes(
		state,
	);
}

////////////////////////////////////////////////////////////////////////////////

/**
 * useFocusManagement moves focus back to the input if we start navigating w/
 * the keyboard after focus has moved to any focusable content in the popup.
 * @param {Event | undefined} lastEventType
 * @param {MutableRefObject<HTMLInputElement | null | undefined>} inputRef
 */
function useFocusManagement(lastEventType, inputRef) {
	// NOTE(joel): We use `useLayoutEffect` here because the cursor goes
	// to the end of the input if we're using `useEffect`.
	useLayoutEffect(() => {
		if (
			lastEventType === Event.NAVIGATE ||
			lastEventType === Event.ESCAPE ||
			lastEventType === Event.SELECT_WITH_CLICK ||
			lastEventType === Event.OPEN_WITH_BUTTON
		) {
			inputRef.current?.focus();
		}
		// NOTE(joel): We can safely silence the exhaustive-deps rule here, because
		// inputRef is a mutable variable and doesn't trigger a re-render.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [lastEventType]);
}

////////////////////////////////////////////////////////////////////////////////

/**
 * useKeyDown shares common key events between our input and popup components.
 */
function useKeyDown() {
	const {
		data: { navigationValue },
		onSelect,
		state,
		transition,
		autocompletePropRef,
		persistSelectionRef,
	} = useContext(ComboboxContext);

	const options = useDescendants(ComboboxDescendantContext);

	/**
	 * @param {KeyboardEvent} event
	 */
	function handleKeyDown(event) {
		const index = options.findIndex(({ value }) => value === navigationValue);

		function getNextOption() {
			const atBottom = index === options.length - 1;
			if (atBottom) {
				if (autocompletePropRef.current) {
					// NOTE(joel): Go back to the value the user has typed because we are
					// autocompleting and they need to be able to get back to what
					// they had typed w/o having to backspace out.
					return null;
				}
				return getFirstOption();
			}
			// NOTE(joel): Go to the next item in the list.
			return options[(index + 1) % options.length];
		}

		function getPreviousOption() {
			const atTop = index === 0;
			if (atTop) {
				if (autocompletePropRef.current) {
					// NOTE(joel): Go back to the value the user has typed because we are
					// autocompleting and they need to be able to get back to what
					// they had typed w/o having to backspace out.
					return null;
				}
				return getLastOption();
			} else if (index === -1) {
				// NOTE(joel): Displaying the user's value, so go select the last one.
				return getLastOption();
			}
			// NOTE(joel): Normal case, select previous.
			return options[(index - 1 + options.length) % options.length];
		}

		function getFirstOption() {
			return options[0];
		}

		function getLastOption() {
			return options[options.length - 1];
		}

		switch (event.key) {
			case 'ArrowDown': {
				// NOTE(joel): We don't want the page to scroll when navigating.
				event.preventDefault();
				if (!options || !options.length) return;

				if (state === State.IDLE) {
					// NOTE(joel): Opening a closed list.
					transition(Event.NAVIGATE, {
						persistSelection: persistSelectionRef.current,
					});
				} else {
					let next = getNextOption();
					transition(Event.NAVIGATE, { value: next ? next.value : null });
				}
				break;
			}

			case 'ArrowUp': {
				// NOTE(joel): We don't want the page to scroll when navigating.
				event.preventDefault();
				if (!options || options.length === 0) return;

				if (state === State.IDLE) {
					transition(Event.NAVIGATE);
				} else {
					let prev = getPreviousOption();
					transition(Event.NAVIGATE, { value: prev ? prev.value : null });
				}
				break;
			}

			case 'Home':
			case 'PageUp': {
				// NOTE(joel): We don't want the page to scroll when navigating.
				event.preventDefault();
				if (!options || options.length === 0) return;

				if (state === State.IDLE) {
					transition(Event.NAVIGATE);
				} else {
					transition(Event.NAVIGATE, { value: getFirstOption().value });
				}
				break;
			}

			case 'End':
			case 'PageDown': {
				// NOTE(joel): We don't want the page to scroll when navigating.
				event.preventDefault();
				if (!options || options.length === 0) return;

				if (state === State.IDLE) {
					transition(Event.NAVIGATE);
				} else {
					transition(Event.NAVIGATE, { value: getLastOption().value });
				}
				break;
			}

			case 'Escape': {
				if (state !== State.IDLE) {
					transition(Event.ESCAPE);
				}
				break;
			}

			case 'Enter': {
				if (state === State.NAVIGATING && navigationValue !== null) {
					// NOTE(joel): Prevent submitting forms.
					event.preventDefault();
					onSelect && onSelect(navigationValue);
					transition(Event.SELECT_WITH_KEYBOARD);
				}
				break;
			}
		}
	}

	return handleKeyDown;
}

////////////////////////////////////////////////////////////////////////////////

function useBlur() {
	const { state, transition, popoverRef, inputRef, buttonRef } =
		useContext(ComboboxContext);

	/**
	 * handleBlur
	 * @param {FocusEvent} event
	 */
	function handleBlur(event) {
		const popover = popoverRef.current;
		const input = inputRef.current;
		const button = buttonRef.current;
		const activeElement = event.relatedTarget;

		// NOTE(joel): We only want to close the list if focus leaves the combobox.
		if (activeElement !== input && activeElement !== button && popover) {
			if (popover.contains(activeElement)) {
				// NOTE(joel): Focus landed inside the combobox, keep it open.
				if (state !== State.INTERACTING) {
					transition(Event.INTERACT);
				}
			} else {
				// NOTE(joel): Focus landed outside the combobox, close it.
				transition(Event.BLUR);
			}
		}
	}

	return handleBlur;
}

////////////////////////////////////////////////////////////////////////////////

/**
 * @typedef {(data: StateData, event: MachineEvent) => StateData} Reducer
 * @typedef {(event: MachineEventType, payload?: any) => any} Transition
 */

/**
 * useReducerMachine manages transitions between states with a built in reducer
 * to manage the data that goes with those transitions.
 * @param {StateChart} chart
 * @param {Reducer} reducer
 * @param {Partial<StateData>} initialData
 * @returns {Array<State, StateData, Transition>}
 */
function useReducerMachine(chart, reducer, initialData) {
	const [state, setState] = useState(chart.initial);
	const [data, dispatch] = useReducer(reducer, initialData);

	function transition(event, payload = {}) {
		const currentState = chart.states[state];
		const nextState = currentState && currentState.on[event];
		if (nextState) {
			dispatch({ type: event, state, nextState: state, ...payload });
			setState(nextState);
			return;
		}
	}

	return [state, data, transition];
}

////////////////////////////////////////////////////////////////////////////////

/**
 * makeHash generates a simple non-secure hash which we use to track
 * descendants instead of using indexes to prevent issues where the value
 * changes right as one hits enter.
 * @param {string} str
 * @returns {string}
 */
function makeHash(str) {
	let hash = 0;
	if (str.length === 0) {
		return hash;
	}
	for (let i = 0; i < str.length; i++) {
		let char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}
	return hash;
}

////////////////////////////////////////////////////////////////////////////////

const escapeRegexpExp = /([.*+?=^!:${}()|[\]/\\])/g;

/**
 * escapeRegexp escapes regexp special characters in `str`.
 * @param {string} str
 */
export function escapeRegexp(str) {
	return String(str).replace(escapeRegexpExp, '\\$1');
}

////////////////////////////////////////////////////////////////////////////////

/**
 * @typedef {Object} ComboboxContextValue
 * @prop {string | undefined} id
 * @prop {boolean} isExpanded
 * @prop {string | null} navigationValue
 * @prop {State} state
 */

/**
 * useComboboxContext exposes data for a given `Combobox` component to its
 * descendants.
 * @returns {ComboboxContextValue}
 */
export function useComboboxContext() {
	let { isExpanded, comboboxId, data, state } = useContext(ComboboxContext);
	let { navigationValue } = data;
	return useMemo(
		() => ({
			id: comboboxId,
			isExpanded,
			navigationValue: navigationValue ?? null,
			state,
		}),
		[comboboxId, isExpanded, navigationValue, state],
	);
}

////////////////////////////////////////////////////////////////////////////////

/**
 * @typedef {Object} ComboboxOptionContextValue
 * @prop {string} value
 * @prop {number} index
 */

/**
 * useComboboxOptionContext exposes data for a given `ComboboxOption` component
 * to its descendants.
 * @returns {ComboboxOptionContextValue}
 */
export function useComboboxOptionContext() {
	let { value, index } = useContext(OptionContext);
	return useMemo(() => ({ value, index }), [value, index]);
}
