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
			<h2>Example: No popover</h2>
			<div>
				<h2>Clientside Search</h2>
				<Combobox aria-label="choose a city">
					<ComboboxInput className="combobox-input" onChange={handleChange} />
					{results && (
						<ComboboxPopover className="combobox-popover" portal={false}>
							<hr />
							{results.length > 0 ? (
								<ComboboxList>
									{results.slice(0, 10).map((result, index) => (
										<ComboboxOption
											className="combobox-option"
											key={index}
											value={`${result.city}, ${result.state}`}
										/>
									))}
								</ComboboxList>
							) : (
								<p
									style={{
										margin: 0,
										color: '#454545',
										padding: '0.25rem 1rem 0.75rem 1rem',
										fontStyle: 'italic',
									}}
								>
									No results :(
								</p>
							)}
						</ComboboxPopover>
					)}
				</Combobox>
			</div>
		</>
	);
}
