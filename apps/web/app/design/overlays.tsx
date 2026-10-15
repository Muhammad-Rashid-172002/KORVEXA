'use client';
import { Button } from '@glasswork/ui/components/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@glasswork/ui/components/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@glasswork/ui/components/dropdown-menu';
import { Tooltip, TooltipProvider } from '@glasswork/ui/components/tooltip';
import { toast } from 'sonner';

export function DesignOverlays() {
  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-3">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Open dialog</Button>
          </DialogTrigger>
          <DialogContent
            title="Approve milestone?"
            description="Funds for this milestone will be released to the seller."
          >
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button>Approve and release</Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary">Menu</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Tooltip content="Short hints appear on hover and focus">
          <Button variant="ghost">Tooltip</Button>
        </Tooltip>
        <Button variant="secondary" onClick={() => toast.success('Saved')}>
          Toast
        </Button>
      </div>
    </TooltipProvider>
  );
}
