import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dropdown, type DropdownOption } from "./Dropdown";

const mockOptions: DropdownOption[] = [
  { value: "opt1", label: "Option 1" },
  { value: "opt2", label: "Option 2" },
  { value: "opt3", label: "Option 3" },
];

describe("Dropdown", () => {
  describe("open/close behavior", () => {
    it("opens menu when button is clicked", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <Dropdown value="" options={mockOptions} onChange={onChange} />
      );

      // Menu should not be visible initially
      expect(screen.queryByText("Option 1")).not.toBeInTheDocument();

      // Click to open
      await user.click(screen.getByRole("button"));

      // Menu should now be visible
      expect(screen.getByText("Option 1")).toBeInTheDocument();
      expect(screen.getByText("Option 2")).toBeInTheDocument();
      expect(screen.getByText("Option 3")).toBeInTheDocument();
    });

    it("closes menu when clicking outside", async () => {
      const onChange = vi.fn();

      render(
        <div>
          <span data-testid="outside">Outside element</span>
          <Dropdown value="" options={mockOptions} onChange={onChange} />
        </div>
      );

      // Open the dropdown
      fireEvent.click(screen.getByRole("button"));
      expect(screen.getByText("Option 1")).toBeInTheDocument();

      // Click outside
      fireEvent.mouseDown(screen.getByTestId("outside"));

      // Menu should close
      expect(screen.queryByText("Option 1")).not.toBeInTheDocument();
    });

    it("toggles menu on repeated button clicks", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <Dropdown value="" options={mockOptions} onChange={onChange} />
      );

      const button = screen.getByRole("button");

      // Open
      await user.click(button);
      expect(screen.getByText("Option 1")).toBeInTheDocument();

      // Close
      await user.click(button);
      expect(screen.queryByText("Option 1")).not.toBeInTheDocument();

      // Open again
      await user.click(button);
      expect(screen.getByText("Option 1")).toBeInTheDocument();
    });
  });

  describe("selection behavior", () => {
    it("calls onChange when option is selected", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <Dropdown value="" options={mockOptions} onChange={onChange} />
      );

      // Open and select
      await user.click(screen.getByRole("button"));
      await user.click(screen.getByText("Option 2"));

      expect(onChange).toHaveBeenCalledWith("opt2");
    });

    it("closes menu after selection", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <Dropdown value="" options={mockOptions} onChange={onChange} />
      );

      // Open and select
      await user.click(screen.getByRole("button"));
      await user.click(screen.getByText("Option 2"));

      // Menu should be closed
      expect(screen.queryByText("Option 1")).not.toBeInTheDocument();
    });

    it("displays selected option label", () => {
      const onChange = vi.fn();

      render(
        <Dropdown value="opt2" options={mockOptions} onChange={onChange} />
      );

      expect(screen.getByRole("button")).toHaveTextContent("Option 2");
    });

    it("displays placeholder when no value selected", () => {
      const onChange = vi.fn();

      render(
        <Dropdown
          value=""
          options={mockOptions}
          onChange={onChange}
          placeholder="Select an option"
        />
      );

      expect(screen.getByRole("button")).toHaveTextContent("Select an option");
    });
  });

  describe("accessibility", () => {
    it("can be identified by id", () => {
      const onChange = vi.fn();

      render(
        <Dropdown
          id="my-dropdown"
          value=""
          options={mockOptions}
          onChange={onChange}
        />
      );

      expect(screen.getByRole("button")).toHaveAttribute("id", "my-dropdown");
    });
  });

  describe("edge cases", () => {
    it("displays raw value when no matching option found", () => {
      const onChange = vi.fn();

      render(
        <Dropdown
          value="nonexistent"
          options={mockOptions}
          onChange={onChange}
        />
      );

      // Should display the raw value when no label match is found
      expect(screen.getByRole("button")).toHaveTextContent("nonexistent");
    });

    it("handles empty options array", () => {
      const onChange = vi.fn();

      render(
        <Dropdown
          value=""
          options={[]}
          onChange={onChange}
          placeholder="No options"
        />
      );

      expect(screen.getByRole("button")).toHaveTextContent("No options");
    });
  });
});
