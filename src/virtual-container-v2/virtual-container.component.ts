import { Component, Renderer, OnInit, Input, Output, EventEmitter, ViewChild, TemplateRef, ElementRef, ComponentRef, ComponentFactoryResolver, ViewContainerRef } from '@angular/core';
import { VerticalChunkComponent } from './vertical-chunk.component';
import { VirtualRow } from './virtual-row.interface';
import { VirtualCell } from './virtual-cell.interface';

@Component({
  selector: 'virtual-container',
  styleUrls: ['./virtual-container.component.css'],
  template:
    `<div #mainContainer class="mainContainer" [ngStyle]="{width: containerWidth, height: containerHeight}" >
      <div #displayContainer class="displayContainer" [ngStyle]="{width: containerWidth, height:containerHeight}" (mousemove)="onMouseMoveContent($event)" (wheel)="onWheelContent($event)">
        <ng-template #chunksContainer></ng-template>
        <div *ngIf="enableScrollbars" [ngStyle]="{width: '10000px', height: '10000px'}"></div>
      </div>
      <div #scrollContainer class="scrollContainer" [ngStyle]="{width: containerWidth, height: containerHeight, overflow: enableScrollbars ? 'auto' : 'hidden'}" (scroll)="onScroll($event)" (mousemove)="onMouseMoveScroll($event)">
        <div class="scrollInner" [ngStyle]="{width: contentWidth + 'px', height: contentHeight + 'px'}" ></div>
      </div>
    </div>`
})
export class VirtualContainerComponent implements OnInit {
  @Input() containerWidth: string;
  @Input() containerHeight: string;
  @Input() cols: Array<{
    field: string,
    width: string
  }>;
  @Input() data: Array<Object>;
  @Input() horizontalItemWidth: number;
  @Input() verticalItemHeight: number;
  @Input() rowComponent: any;
  @Input() cellComponent: any;
  @Input() rowDefaults: any;
  @Input() cellDefaults: any;
  @Input() enableScrollbars = true;
  @Input() bindScrollTo: ElementRef;

  @Output() virtScroll = new EventEmitter();
  @Output() chunksRendered = new EventEmitter();

  @ViewChild('mainContainer') mainContainer;
  @ViewChild('displayContainer') displayContainer;
  @ViewChild('scrollContainer') scrollContainer;
  @ViewChild('chunksContainer', {read: ViewContainerRef}) chunksContainer: ViewContainerRef; 

  private maxRowWidth: number;
  private contentWidth: number;
  private contentHeight: number;
  private lastScrollTop: number;
  private lastScrollLeft: number;
  private accScrollTop: number;

  private vChunkNumRows: number;
  private _renderRestChunksTimer: any;
  private endColIndex: number;

  public cells: Array<Array<ComponentRef<{}>>>;
  public rows: Array<{
    index: number,
    elem: ComponentRef<{}>
  }>;

  constructor(private renderer:Renderer, private componentFactoryResolver: ComponentFactoryResolver) {
    this.cols = [];
    this.data = [];
    this.horizontalItemWidth = 100,
    this.verticalItemHeight = 25
    this.contentWidth = 0;
    this.contentHeight = 0;
    this.lastScrollTop = 0
    this.lastScrollLeft = 0;
    this.accScrollTop = 0;
    this.endColIndex = 0;

    this.rows = [];
    this.cells = [];
   }

  ngOnInit() {
    this.calculateTotalSize();
  }

  ngAfterViewInit() {
    this.displayContainer.nativeElement.style.top = "0px";
    this.displayContainer.nativeElement.style.left = "0px";

    this.createInitView();

    //this.chunksRendered.emit({
      //rows: this.previousChunk.instance.rows.concat(this.currentChunk.instance.rows).concat(this.nextChunk.instance.rows)
    //});

    if(!this.bindScrollTo) {
      this.bindScrollTo = this.scrollContainer;
    }
    this.bindScrollTo.nativeElement.addEventListener('scroll', this.onScroll, false);
  }

  calculateTotalSize() {
    for(let i=0; i < this.cols.length; i++) {
      this.contentWidth += parseInt(this.cols[i].width);
    }

    for(let i=0; i < this.data.length; i++) {
      this.contentHeight += this.verticalItemHeight;
    }

    this.vChunkNumRows = Math.floor(parseInt(this.containerHeight) / this.verticalItemHeight) + 1;
  }

  sliceColumns(row, startIndex, endIndex) {
    var slicedCols = {},
        keys = Object.keys(row);

    for(let j = startIndex; j < endIndex; j++) {
      slicedCols[keys[j]] = row[keys[j]];
    }
    
    return slicedCols;
  }
  createCell(value, column) {
    var cellComponentFactory = this.componentFactoryResolver.resolveComponentFactory(this.cellComponent);  
    var newCell = this.chunksContainer.createComponent(cellComponentFactory);
    (<VirtualCell>newCell.instance).height = this.verticalItemHeight;
    (<VirtualCell>newCell.instance).width = column.width;
    (<VirtualCell>newCell.instance).defaultOptions = this.cellDefaults;
    (<VirtualCell>newCell.instance).value = value;
    (<VirtualCell>newCell.instance).changeDet.detectChanges();

    return newCell;
  }

  createRowStart(rowData, startColIndex, endColIndex) {
    var rowComponentFactory = this.componentFactoryResolver.resolveComponentFactory(this.rowComponent),
      colsData = this.cols.slice(startColIndex, endColIndex),
      cellsData = this.sliceColumns(rowData, startColIndex, endColIndex),
      rowNativeCells = [];

    this.cells.unshift([]);
    for(let i = 0; i < colsData.length; i++) {
      let newCell = this.createCell(cellsData[colsData[i].field], colsData[i]);
      
      rowNativeCells.push(newCell.location.nativeElement);
      this.cells[0].push(newCell);
    }
      
    let newRow = this.chunksContainer.createComponent(rowComponentFactory, 0, undefined, [ rowNativeCells ]);
    
    (<VirtualRow>newRow.instance).height = this.verticalItemHeight;
    (<VirtualRow>newRow.instance).width = this.maxRowWidth;
    (<VirtualRow>newRow.instance).defaultOptions = this.rowDefaults;

    for (let i = 0 ; i < this.cells[0].length; i++) {
      (<VirtualCell>this.cells[0][i].instance).row = newRow.instance;
    }

    (<VirtualRow>newRow.instance).changeDet.detectChanges();
    return newRow;
  }

  createRowEnd(rowData, startColIndex, endColIndex) {
    var rowComponentFactory = this.componentFactoryResolver.resolveComponentFactory(this.rowComponent),
      colsData = this.cols.slice(startColIndex, endColIndex),
      cellsData = this.sliceColumns(rowData, startColIndex, endColIndex),
      newCellsIndex = this.cells.length,
      rowNativeCells = [];

    this.cells.push([]);
    for(let i = 0; i < colsData.length; i++) {
      let newCell = this.createCell(cellsData[colsData[i].field], colsData[i]);
      
      rowNativeCells.push(newCell.location.nativeElement);
      this.cells[newCellsIndex].push(newCell);
    }
      
    let newRow = this.chunksContainer.createComponent(rowComponentFactory, this.rows.length, undefined, [ rowNativeCells ]);
    
    (<VirtualRow>newRow.instance).height = this.verticalItemHeight;
    (<VirtualRow>newRow.instance).width = this.maxRowWidth;
    (<VirtualRow>newRow.instance).defaultOptions = this.rowDefaults;

    for (let i = 0 ; i < this.cells[newCellsIndex].length; i++) {
      (<VirtualCell>this.cells[newCellsIndex][i].instance).row = newRow.instance;
    }

    (<VirtualRow>newRow.instance).changeDet.detectChanges();
    return newRow;
  }

  createInitView() {
    var initData = this.data.slice(0, this.vChunkNumRows + 1),
      curLength = 0,
      containerWidth = parseInt(this.containerWidth);

    for(let i = 0; i < this.cols.length; i++) {
      if(curLength > containerWidth) {
        this.endColIndex = i;
        break;
      }
      curLength += parseInt(this.cols[i].width);
    }

    let newRow = this.createRowEnd(initData[0], 0, this.endColIndex + 1);
    this.rows.push({
      index: 0,
      elem: newRow
    });

    //We do it backwards because createComponent needs to have index specified, and we use 0 there for each new row and they are added on top
    for(let i = 0; i < initData.length; i++) {
      let newRow = this.createRowEnd(initData[i], 0, this.endColIndex + 1);
      this.rows.push({
        index: i,
        elem: newRow
      });
    }

    this.displayContainer.nativeElement.style.top = -this.verticalItemHeight + "px";
  }

  loadNextRow() {
    var newRow, oldRow, oldCells,
      newRowIndex = this.rows[this.rows.length - 1].index + 1,
      newRowData = this.data[newRowIndex];

    if(!newRowData) {
      newRowIndex = this.data.length - 1;
      newRowData = this.data[newRowIndex];
    }

    oldRow = this.rows.shift();
    oldCells = this.cells.shift();

    //clear old cells and the row itself
    for(let i = 0; i < oldCells.length; i++) {
      oldCells[i].hostView.destroy();
      oldCells[i].destroy();
    }
    oldRow.elem.hostView.destroy();
    oldRow.elem.destroy();
    
    //new row creation
    newRow = this.createRowEnd(newRowData, 0, this.endColIndex);
    this.rows.push({
      index: newRowIndex,
      elem: newRow
    });
  }

  loadPrevRow() {
    var newRow, oldRow, oldCells,
      newRowIndex = this.rows[0].index - 1,
      newRowData = this.data[newRowIndex];

      if(!newRowData) {
        newRowIndex = 0;
        newRowData = this.data[newRowIndex];
        this.displayContainer.nativeElement.style.top = -this.verticalItemHeight + "px";
      }

    oldRow = this.rows.pop();
    oldCells = this.cells.pop();

    //clear old cells and the row itself
    for(let i = 0; i < oldCells.length; i++) {
      oldCells[i].hostView.destroy();
      oldCells[i].destroy();
    }
    oldRow.elem.hostView.destroy();
    oldRow.elem.destroy();
    
    //new row creation
    newRow = this.createRowStart(newRowData, 0, this.endColIndex);
    this.rows.unshift({
      index: newRowIndex,
      elem: newRow
    });
  }

  
  fixUpdateAllRows(scrollTop) {
    var startIndex = Math.floor(scrollTop / this.verticalItemHeight),
      endIndex = startIndex + this.rows.length,
      rowsData = this.data.slice(startIndex, endIndex),
      colsData = this.cols.slice(0, this.endColIndex + 1);
    
    for(let i = 0; i < this.cells.length; i++) {
      let cellsData;
      this.rows[i].index = startIndex + i;
      if(!rowsData[i] && startIndex < 0) {
        cellsData = this.sliceColumns(rowsData[0], 0, this.endColIndex);
      } else if(!rowsData[i] && endIndex >= this.data.length) {
        cellsData = this.sliceColumns(rowsData[rowsData.length - 1], 0, this.endColIndex);
      } else{
        cellsData = this.sliceColumns(rowsData[i], 0, this.endColIndex);
      }

      for(let j = 0; j < this.cells[i].length; j++) {
        (<VirtualCell>this.cells[i][j].instance).value = cellsData[colsData[j].field];
      }
    }
  }

  onScroll = (event) => {
    var newVChunkIndex, newHChunkIndex,
        curScrollTop = event.target.scrollTop,
        curScrollLeft = event.target.scrollLeft,
        vDir = Math.sign(curScrollTop - this.lastScrollTop),
        hDir = Math.sign(curScrollLeft - this.lastScrollLeft);

    this.virtScroll.emit({scrollTop: curScrollTop, scrollLeft: curScrollLeft});

    //Updating vertical chunks
    if(curScrollTop != this.lastScrollTop) {
      if(Math.abs(curScrollTop - this.lastScrollTop) <= this.verticalItemHeight) {
        let newTop = parseInt(this.displayContainer.nativeElement.style.top) - (curScrollTop - this.lastScrollTop);
        this.displayContainer.nativeElement.style.top =  newTop + "px";
      }
      
      this.accScrollTop += curScrollTop - this.lastScrollTop;
      if(Math.abs(this.accScrollTop) / this.verticalItemHeight  >= 1) {
        let numToRender = Math.floor(Math.abs(this.accScrollTop) / this.verticalItemHeight);
        this.accScrollTop = this.accScrollTop % this.verticalItemHeight;

        if(numToRender < this.vChunkNumRows) {
          this.displayContainer.nativeElement.style.top = Math.sign(vDir) * (-this.accScrollTop) + "px";

          for(let i = 0 ; i < numToRender; i ++) {
            if(vDir >= 0) {
              this.loadNextRow();
            } else {
              this.loadPrevRow();
            }
          }
        } else {
          this.fixUpdateAllRows(curScrollTop);
          this.displayContainer.nativeElement.style.top = "0px";
        }
      }
    }

    //Updating horizontal chunks
    // if(curScrollLeft != this.lastScrollLeft) {
    //   let currentWidth = 0;

    //   for(let i = 0; i < this.previousChunk.instance.data.hChunks[0].length; i++) {
    //     if (hDir > 0 &&
    //         currentWidth <= curScrollLeft &&
    //         curScrollLeft < currentWidth + this.previousChunk.instance.data.hChunks[0][i].width &&
    //         i >= this.currentHChunkIdx) {
    //       newHChunkIndex = i;
    //       break;
    //     } else if (hDir <= 0 && 
    //         currentWidth - this.previousChunk.instance.data.hChunks[0][i].width <= curScrollLeft &&
    //         curScrollLeft < currentWidth && 
    //         i <= this.currentHChunkIdx) {
    //       newHChunkIndex = i;
    //       break;
    //     }

    //     currentWidth += this.previousChunk.instance.data.hChunks[0][i].width;
    //   }

    //   if(Math.abs(curScrollLeft - this.lastScrollLeft) <= this.previousChunk.instance.data.hChunks[0][0].width) {
    //     let newLeft = parseInt(this.displayContainer.nativeElement.style.left) - (curScrollLeft - this.lastScrollLeft);
    //     this.displayContainer.nativeElement.style.left =  newLeft + "px";
    //   }

    //   if(newHChunkIndex && newHChunkIndex !== this.currentHChunkIdx) {
    //     this.currentHChunkIdx = newHChunkIndex;  
        
    //     this.updateHorizontalChunks(this.previousChunk, this.currentHChunkIdx);
    //     this.updateHorizontalChunks(this.currentChunk, this.currentHChunkIdx);
    //     this.updateHorizontalChunks(this.nextChunk, this.currentHChunkIdx);

    //     this.displayContainer.nativeElement.style.left = (-this.previousChunk.instance.data.hChunks[0][this.currentHChunkIdx-1].width - (curScrollLeft - currentWidth)) + "px";
    //   }
    // }
    
    //Cache data for the next scroll
    this.lastScrollTop = curScrollTop;
    this.lastScrollLeft = curScrollLeft;
  }

  onMouseMoveScroll(event) {
    if (event.layerX < parseInt(this.containerWidth) - 17 && 
        event.layerY < parseInt(this.containerHeight) - 17 &&
        event.offsetX - 2 <= event.layerX && event.layerX <= event.offsetX + 2 &&
        event.offsetY - 2 <= event.layerY && event.layerY <= event.offsetY + 2 &&
        this.scrollContainer.nativeElement.style.pointerEvents !== "none") {
      this.scrollContainer.nativeElement.style.pointerEvents = "none";
    }
  }

  onMouseMoveContent(event) {
    if (/Edge/.test(navigator.userAgent)) {
      if ((event.layerX > parseInt(this.containerWidth) - 17 || 
          event.layerY > parseInt(this.containerHeight) - 17) && 
          this.scrollContainer.nativeElement.style.pointerEvents !== "auto") {
        this.scrollContainer.nativeElement.style.pointerEvents = "auto";
      }
    } else {
      if ((event.layerX + parseInt(this.displayContainer.nativeElement.style.left) > parseInt(this.containerWidth) - 17 || 
          event.layerY + parseInt(this.displayContainer.nativeElement.style.top) > parseInt(this.containerHeight) - 17) && 
          this.scrollContainer.nativeElement.style.pointerEvents !== "auto") {
        this.scrollContainer.nativeElement.style.pointerEvents = "auto";
      }
    }
  }

  onWheelContent(event) {
    var scrollDeltaY;

    if (event.wheelDeltaY) {
      /* Option supported on Chrome, Safari, Opera.
      /* 120 is default for mousewheel on these browsers. Other values are for trackpads */
      scrollDeltaY = -event.wheelDeltaY / 120;
    } else if (event.deltaY) {
      /* For other browsers that don't provide wheelDelta, use the deltaY to determine direction and pass default values. */
      scrollDeltaY = event.deltaY > 0 ? 1 : -1;
    }

    if (/Edge/.test(navigator.userAgent)) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollTop + event.deltaY / 3;
    } else {
      this.smoothWheelScrollY(scrollDeltaY);
    }
    this.scrollContainer.nativeElement.scrollLeft = this.scrollContainer.nativeElement.scrollLeft + event.deltaX;
    
    return false;
  }

  smoothWheelScrollY(deltaY: number) {
    var self = this,
      smoothingStep = 2,
      smoothingDuration = 0.5,
      animationId;

    //We use the formula for parabola y = -3*x*x + 3 to simulate smooth inertia that slows down
    var x = -1;
    function inertiaStep() {
      if (x > 1) {
        cancelAnimationFrame(animationId);
        return;
      }

      let nextY = ((-3 * x * x + 3) * deltaY * 2) * smoothingStep;
      self.scrollContainer.nativeElement.scrollTop = self.scrollContainer.nativeElement.scrollTop + nextY;

      //continue the intertia
      x += 0.08 * (1 / smoothingDuration);
      animationId = requestAnimationFrame(inertiaStep);
    }

    animationId = requestAnimationFrame(inertiaStep);
  }

  gOnDestroy() {
      this.bindScrollTo.nativeElement.removeEventListener('scroll', this.onScroll, false);
  }
}
