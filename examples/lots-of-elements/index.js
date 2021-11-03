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
			<h2>Example: Lots of Elements</h2>
			<div>
				<h2>Clientside Search</h2>
				<Combobox aria-label="choose a city">
					<ComboboxInput
						className="combobox-input"
						autocomplete={false}
						onChange={handleChange}
					/>
					{results && (
						<ComboboxPopover className="combobox-popover">
							{results.length > 0 ? (
								<ComboboxList>
									<h3>top 3 results!</h3>
									{results.slice(0, 3).map((result, index) => (
										<ComboboxOption
											className="combobox-option"
											key={index}
											value={`${result.city}, ${result.state}`}
										/>
									))}
									{results.length > 3 && (
										<React.Fragment>
											<hr />
											<h3>the other stuff</h3>
											{results.slice(3, 10).map((result, index) => (
												<ComboboxOption
													className="combobox-option"
													key={index}
													value={`${result.city}, ${result.state}`}
												/>
											))}
										</React.Fragment>
									)}
								</ComboboxList>
							) : (
								<p style={{ padding: '0 10px' }}>
									No results, peace be with you.
								</p>
							)}
						</ComboboxPopover>
					)}
				</Combobox>
			</div>
		</>
	);
}
