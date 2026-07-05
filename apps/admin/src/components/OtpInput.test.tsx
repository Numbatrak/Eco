import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OtpInput, type OtpInputProps } from "./OtpInput";

function ControlledOtp(props: Partial<OtpInputProps>): React.ReactElement {
  const [value, setValue] = useState(props.value ?? "");
  return (
    <OtpInput
      length={6}
      label="Code"
      value={value}
      onChange={setValue}
      onComplete={props.onComplete}
      error={props.error}
    />
  );
}

describe("OtpInput", () => {
  it("renders one box per digit", () => {
    render(<ControlledOtp />);
    expect(screen.getAllByLabelText(/Digit \d of 6/)).toHaveLength(6);
  });

  it("typing a digit advances focus to the next box", async () => {
    const user = userEvent.setup();
    render(<ControlledOtp />);
    const boxes = screen.getAllByLabelText(/Digit \d of 6/);

    await user.type(boxes[0]!, "1");
    expect(boxes[0]).toHaveValue("1");
    expect(boxes[1]).toHaveFocus();
  });

  it("fires onComplete once all boxes are filled by typing", async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<ControlledOtp onComplete={onComplete} />);
    const boxes = screen.getAllByLabelText(/Digit \d of 6/);

    for (const [index, digit] of ["1", "2", "3", "4", "5", "6"].entries()) {
      await user.type(boxes[index]!, digit);
    }

    expect(onComplete).toHaveBeenCalledWith("123456");
  });

  it("distributes a pasted full code across all boxes at once", () => {
    const onComplete = vi.fn();
    render(<ControlledOtp onComplete={onComplete} />);
    const boxes = screen.getAllByLabelText(/Digit \d of 6/);

    fireEvent.paste(boxes[0]!, {
      clipboardData: { getData: () => "123456" },
    });

    boxes.forEach((box, index) => {
      expect(box).toHaveValue(String(index + 1));
    });
    expect(onComplete).toHaveBeenCalledWith("123456");
  });

  it("strips non-digit characters from a paste (e.g. a code copied with spaces)", () => {
    render(<ControlledOtp />);
    const boxes = screen.getAllByLabelText(/Digit \d of 6/);

    fireEvent.paste(boxes[0]!, {
      clipboardData: { getData: () => "12 34 56" },
    });

    boxes.forEach((box, index) => {
      expect(box).toHaveValue(String(index + 1));
    });
  });

  it("backspacing an empty box moves focus back and clears the previous digit", async () => {
    const user = userEvent.setup();
    render(<ControlledOtp />);
    const boxes = screen.getAllByLabelText(/Digit \d of 6/);

    await user.type(boxes[0]!, "1");
    expect(boxes[1]).toHaveFocus();

    await user.keyboard("{Backspace}");
    expect(boxes[0]).toHaveFocus();
    expect(boxes[0]).toHaveValue("");
  });

  it("shows the error message when provided", () => {
    render(<ControlledOtp error="Invalid code" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid code");
  });
});
