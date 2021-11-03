# @react-lit/combobox

Accessible combobox (autocomplete or autosuggest) component for React.

A combobox is the combination of an `<input type="text" />` and a list.
The list is designed to help the user arrive at a value, but the value does
not necessarily have to come from that list.

## Installation

```bash
$ npm i @react-lit/combobox
# or
$ yarn add @react-lit/combobox
```

## Example

```js
import * as React from 'react';
import {
  Combobox,
  ComboboxInput,
  ComboboxPopover,
  ComboboxList,
  ComboboxOption,
  ComboboxOptionText,
} from "@react-lit/combobox";

function Example() {
  return (
    <Combobox>
      <ComboboxInput aria-labelledby="combobox" />
      <ComboboxPopover>
        <ComboboxList aria-labelledby="combobox">
          <ComboboxOption value="Apple" />
          <ComboboxOption value="Banana" />
          <ComboboxOption value="Orange" />
          <ComboboxOption value="Pineapple" />
          <ComboboxOption value="Kiwi" />
        </ComboboxList>
      </ComboboxPopover>
    </Combobox>
  );
}
```

## Development

(1) Install dependencies

```bash
$ npm i
# or
$ yarn
```

(2) Run initial validation

```bash
$ ./Taskfile.sh validate
```

(3) Run tests in watch-mode to validate functionality.

```bash
$ ./Taskfile test -w
```

---

_This project was set up by @jvdx/core_
