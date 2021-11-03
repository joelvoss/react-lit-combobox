import * as React from 'React';
import {
	Combobox,
	ComboboxInput,
	ComboboxList,
	ComboboxOption,
	ComboboxPopover,
} from '../../src/index';

export function Example() {
	const [term, setTerm] = React.useState('');
	const [selection, setSelection] = React.useState('');

	function handleChange(event) {
		setTerm(event.target.value);
	}

	function handleSelect(value) {
		setSelection(value);
		setTerm(value);
	}

	return (
		<>
			<h2>Example: Open on focus</h2>
			<div>
				<p>Selection: {selection}</p>
				<Combobox
					openOnFocus
					onSelect={handleSelect}
					aria-label="choose a city"
				>
					<ComboboxInput
						onChange={handleChange}
						value={term}
						className="combobox-input"
					/>
					<ComboboxPopover className="combobox-popover">
						<ComboboxList>
							<ComboboxOption className="combobox-option" value="Apple" />
							<ComboboxOption className="combobox-option" value="Banana" />
							<ComboboxOption className="combobox-option" value="Orange" />
							<ComboboxOption className="combobox-option" value="Pineapple" />
							<ComboboxOption className="combobox-option" value="Kiwi" />
						</ComboboxList>
					</ComboboxPopover>
				</Combobox>
			</div>
		</>
	);
}
