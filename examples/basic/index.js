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
	const results = useCityMatch(term);

	const handleChange = event => {
		setTerm(event.target.value);
	};

	return (
		<>
			<h2>Example: Basic</h2>
			<div>
				<h2>Clientside Search</h2>
				<Combobox id="holy-smokes" aria-label="choose a city">
					<ComboboxInput onChange={handleChange} className="combobox-input" />
					{results && (
						<ComboboxPopover className="combobox-popover">
							<p>
								<button>Hi</button>
							</p>
							<ComboboxList>
								{results.slice(0, 10).map((result, index) => (
									<ComboboxOption
										className="combobox-option"
										key={index}
										value={`${result.city}, ${result.state}`}
									/>
								))}
							</ComboboxList>
						</ComboboxPopover>
					)}
				</Combobox>
			</div>
		</>
	);
}
