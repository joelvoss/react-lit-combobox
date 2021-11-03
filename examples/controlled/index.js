import * as React from 'React';
import {
	Combobox,
	ComboboxInput,
	ComboboxList,
	ComboboxOption,
	ComboboxPopover,
} from '../../src/index';
import { useCityMatch } from '../utils';

export function Example() {
	const [term, setTerm] = React.useState('');
	const [selection, setSelection] = React.useState('');
	const results = useCityMatch(term);
	const ref = React.useRef();

	const handleChange = event => {
		setTerm(event.target.value);
	};

	const handleSelect = value => {
		setSelection(value);
		setTerm('');
	};

	return (
		<>
			<h2>Example: Controlled</h2>
			<div>
				<h2>Clientside Search</h2>
				<p>Selection: {selection}</p>
				<p>Term: {term}</p>
				<Combobox onSelect={handleSelect} aria-label="choose a city">
					<ComboboxInput
						ref={ref}
						value={term}
						onChange={handleChange}
						autocomplete={false}
						className="combobox-input"
					/>
					{results && (
						<ComboboxPopover className="combobox-popover">
							{results.length === 0 && (
								<p>
									No Results{' '}
									<button
										onClick={() => {
											setTerm('');
											ref.current.focus();
										}}
									>
										clear
									</button>
								</p>
							)}
							<ComboboxList>
								{results.slice(0, 10).map((result, index) => (
									<ComboboxOption
										className="combobox-option"
										key={index}
										value={`${result.city}, ${result.state}`}
									/>
								))}
							</ComboboxList>
							<p>
								<a href="/new">Add a record</a>
							</p>
						</ComboboxPopover>
					)}
				</Combobox>
			</div>
		</>
	);
}
