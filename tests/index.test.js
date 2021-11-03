import * as React from 'react';
import { matchSorter } from 'match-sorter';
import { render, withMarkup, userEvent } from './test-utils';
import { cities } from '../examples/cities';
import {
	Combobox,
	ComboboxInput,
	ComboboxList,
	ComboboxOption,
	ComboboxPopover,
	useComboboxContext,
} from '../src/index';

describe('<Combobox />', () => {
	describe('rendering', () => {
		it('renders as any HTML element', () => {
			function Comp() {
				let [term, setTerm] = React.useState('');
				let results = useCityMatch(term);

				return (
					<div>
						<Combobox data-testid="box" as="span">
							<ComboboxInput
								data-testid="input"
								as="textarea"
								onChange={event => setTerm(event.target.value)}
							/>
							{results ? (
								<ComboboxPopover portal={false}>
									<ComboboxList as="div">
										{results.slice(0, 10).map((result, index) => (
											<ComboboxOption
												as="div"
												key={index}
												value={`${result.city}, ${result.state}`}
											/>
										))}
									</ComboboxList>
								</ComboboxPopover>
							) : null}
						</Combobox>
					</div>
				);
			}

			let { getByTestId, getByRole, getAllByRole } = render(<Comp />);
			expect(getByTestId('box').tagName).toBe('SPAN');
			expect(getByRole('combobox').tagName).toBe('TEXTAREA');

			userEvent.type(getByRole('combobox'), 'e');

			expect(getByRole('listbox').tagName).toBe('DIV');
			expect(getAllByRole('option')[0].tagName).toBe('DIV');
		});

		it('renders when using the useComboboxContext hook', () => {
			function CustomComboboxInput(props) {
				const { isExpanded } = useComboboxContext();
				return (
					<ComboboxInput
						{...props}
						style={{ backgroundColor: isExpanded ? 'cornsilk' : 'aliceblue' }}
					/>
				);
			}

			function Comp() {
				return (
					<Combobox data-testid="box">
						<CustomComboboxInput
							data-testid="input"
							aria-labelledby="choose-a-fruit"
						/>
						<ComboboxPopover>
							<ComboboxList data-testid="list">
								<ComboboxOption value="Apple" />
								<ComboboxOption value="Banana" />
								<ComboboxOption value="Orange" />
							</ComboboxList>
						</ComboboxPopover>
					</Combobox>
				);
			}

			let { getByRole, getAllByRole } = render(<Comp />);

			userEvent.type(getByRole('combobox'), 'a');

			expect(getByRole('listbox')).toBeTruthy();
			expect(getAllByRole('option')[0]).toBeTruthy();
		});
	});

	describe('a11y', () => {
		it('should forward aria-label from Combobox to ComboboxInput', () => {
			function Comp() {
				return (
					<Combobox aria-label="choose a fruit">
						<ComboboxInput />
						<ComboboxPopover>
							<ComboboxList>
								<ComboboxOption value="Apple" />
								<ComboboxOption value="Banana" />
							</ComboboxList>
						</ComboboxPopover>
					</Combobox>
				);
			}

			let { getByRole } = render(<Comp />);
			let input = getByRole('combobox');

			expect(input).toHaveAttribute('aria-label');
			expect(input.getAttribute('aria-label')).toBe('choose a fruit');
		});

		it('should forward aria-labelledby from Combobox to ComboboxInput', () => {
			function Comp() {
				return (
					<div>
						<h1 id="choose-a-fruit">Choose a Fruit</h1>
						<Combobox aria-labelledby="choose-a-fruit">
							<ComboboxInput />
							<ComboboxPopover>
								<ComboboxList>
									<ComboboxOption value="Apple" />
									<ComboboxOption value="Banana" />
								</ComboboxList>
							</ComboboxPopover>
						</Combobox>
					</div>
				);
			}

			let { getByRole } = render(<Comp />);
			let input = getByRole('combobox');

			expect(input).toHaveAttribute('aria-labelledby');
			expect(input.getAttribute('aria-labelledby')).toBe('choose-a-fruit');
		});

		it('aria-label set on ComboboxInput should take precedence', () => {
			function Comp() {
				return (
					<Combobox aria-label="label set on combobox">
						<ComboboxInput aria-label="label set on input" />
						<ComboboxPopover>
							<ComboboxList>
								<ComboboxOption value="Apple" />
								<ComboboxOption value="Banana" />
							</ComboboxList>
						</ComboboxPopover>
					</Combobox>
				);
			}

			let { getByRole } = render(<Comp />);
			let input = getByRole('combobox');

			expect(input).toHaveAttribute('aria-label');
			expect(input.getAttribute('aria-label')).toBe('label set on input');
		});

		it('aria-labelledby set on ComboboxInput should take precedence', () => {
			function Comp() {
				return (
					<div>
						<p id="not-used-for-label">choose a fruit</p>
						<p id="used-for-label">choose a fruit</p>
						<Combobox aria-labelledby="not-used-for-label">
							<ComboboxInput aria-labelledby="used-for-label" />
							<ComboboxPopover>
								<ComboboxList>
									<ComboboxOption value="Apple" />
									<ComboboxOption value="Banana" />
								</ComboboxList>
							</ComboboxPopover>
						</Combobox>
					</div>
				);
			}

			let { getByRole } = render(<Comp />);
			let input = getByRole('combobox');

			expect(input).toHaveAttribute('aria-labelledby');
			expect(input.getAttribute('aria-labelledby')).toBe('used-for-label');
		});
	});

	describe('user events', () => {
		it('should open a list on text entry', () => {
			function Comp() {
				let [term, setTerm] = React.useState('');
				let results = useCityMatch(term);

				return (
					<div>
						<Combobox>
							<ComboboxInput onChange={event => setTerm(event.target.value)} />
							{results ? (
								<ComboboxPopover portal={false}>
									<ComboboxList>
										{results.slice(0, 10).map((result, index) => (
											<ComboboxOption
												key={index}
												value={`${result.city}, ${result.state}`}
											/>
										))}
									</ComboboxList>
								</ComboboxPopover>
							) : null}
						</Combobox>
					</div>
				);
			}

			let optionToSelect = 'Eagle Pass, Texas';
			let { getByRole, getByText } = render(<Comp />);
			let getByTextWithMarkup = withMarkup(getByText);
			let input = getByRole('combobox');

			userEvent.type(input, 'e');

			expect(getByRole('listbox')).toBeInTheDocument();
			expect(getByTextWithMarkup(optionToSelect)).toBeInTheDocument();
		});
	});
});

////////////////////////////////////////////////////////////////////////////////

function useCityMatch(term) {
	return term.trim() === ''
		? null
		: matchSorter(cities, term, {
				keys: [item => `${item.city}, ${item.state}`],
		  });
}

function showOpts(results, render) {
	return results.slice(0, 10).map((result, index) => render({ result, index }));
}
