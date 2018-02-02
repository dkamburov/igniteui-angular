import { Component, OnInit, Input, ViewChild, ViewContainerRef, ChangeDetectorRef } from '@angular/core';
import { VirtualRow } from '../../lib/main';

@Component({
  selector: 'row',
  styleUrls: ['./row.component.css'],
  template: 
    `<div class="rowStyle" [ngStyle]="{width: width ? width + 'px' : 'auto', height: height ? height + 'px' : 'auto'}">
      <ng-template #rowContent ></ng-template>
    </div>`
})
export class RowComponent implements VirtualRow, OnInit {
  @Input() width: number;
  @Input() height: number;
  @Input() rowData: any;
  @Input() defaultOptions: any;
  @Input() cells: Array<any>;

  @ViewChild('rowContent', {read: ViewContainerRef}) rowContent: ViewContainerRef;

  constructor(public changeDet:ChangeDetectorRef) {
  }

  ngOnInit() {
  }
}