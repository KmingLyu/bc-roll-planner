import * as React from "react";
import { NumberField as BaseNumberField } from "@base-ui/react/number-field";
import FormControl from "@mui/material/FormControl";
import OutlinedInput from "@mui/material/OutlinedInput";
import InputLabel from "@mui/material/InputLabel";

/**
 * This component is a placeholder for FormControl to correctly set the shrink label state on SSR.
 */
function SSRInitialFilled(_: BaseNumberField.Root.Props) {
  return null;
}
SSRInitialFilled.muiName = "Input";

export default function NumberField({
  id: idProp,
  label,
  error,
  size = "medium",
  startAdornment,
  ...other
}: BaseNumberField.Root.Props & {
  label?: React.ReactNode;
  size?: "small" | "medium";
  error?: boolean;
  startAdornment?: React.ReactNode;
}) {
  let id = React.useId();
  if (idProp) {
    id = idProp;
  }
  return (
    <BaseNumberField.Root
      {...other}
      render={(props, state) => (
        <FormControl
          size={size}
          ref={props.ref}
          disabled={state.disabled}
          required={state.required}
          error={error}
          variant="outlined"
          fullWidth // 撐滿父層
          style={{ minWidth: 0 }} // 避免 flexbox 爆寬
        >
          {props.children}
        </FormControl>
      )}
    >
      <SSRInitialFilled {...other} />
      <InputLabel htmlFor={id}>{label}</InputLabel>
      <BaseNumberField.Input
        id={id}
        render={(props, state) => (
          <OutlinedInput
            label={label}
            inputRef={props.ref}
            value={state.inputValue}
            onBlur={props.onBlur}
            onChange={props.onChange}
            onKeyUp={props.onKeyUp}
            onKeyDown={props.onKeyDown}
            onFocus={props.onFocus}
            startAdornment={startAdornment}
            slotProps={{
              input: props,
            }}
            fullWidth // ✅ 輸入框本身也撐滿
            sx={{ width: 1 }}
          />
        )}
      />
      {/* <FormHelperText sx={{ ml: 0, "&:empty": { mt: 0 } }}>
        Enter value between 10 and 40
      </FormHelperText> */}
    </BaseNumberField.Root>
  );
}
