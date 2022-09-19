import { Component, OnInit, ViewChild } from "@angular/core";
import { HttpParams } from "@angular/common/http";
import { FormControl, FormGroup } from "@angular/forms";
import { ISegmentMetaData } from "../../../core/types";
import { debounceTime, mergeMap } from "rxjs/operators";
import { SegmentService } from "../../../core/services/segment.service";
import { Observable } from "rxjs";
import { MatPaginator, PageEvent } from "@angular/material/paginator";
import { Router } from "@angular/router";

@Component({
  selector: "segment-list",
  templateUrl: "./segment-list.component.html",
  styleUrls: ["./segment-list.component.scss"],
})
export class SegmentListComponent implements OnInit {
  segmentMetaDataList: ISegmentMetaData[] = [];
  isLoading = false;
  totalCount: number;
  searchValue: string;
  pageSize = 10;
  pageNumber = 0;
  pageSizeOptions: number[] = [10, 20, 30, 40];

  columnList: { label: string; key: string }[] = [
    { label: "Name", key: "name" },
    { label: "User Count", key: "userCount" },
    { label: "Avg Income", key: "avgIncome" },
    { label: "Dominant Gender", key: "topGender" },
  ];

  waitingForResponse: boolean;

  form: FormGroup = new FormGroup({
    search: new FormControl(""),
  });

  @ViewChild(MatPaginator) paginator: MatPaginator;

  constructor(private segmentService: SegmentService, private router: Router) { }

  ngOnInit(): void {
    this.form.controls["search"].valueChanges
      .pipe(
        debounceTime(500),
        mergeMap((value) => {
          this.searchValue = value;
          return this.fetchSegments();
        })
      )
      .subscribe((response) => {
        this.handleListResponse(response);
      });

    this.fetchSegments().subscribe(
      (response) => {
        this.handleListResponse(response);
      },
      (error) => {
        console.log(`error fetching list ${error}`);
      }
    );
  }

  public onPageChange(e: PageEvent) {
    this.pageSize = e.pageSize;
    this.pageNumber = e.pageIndex
    this.fetchSegments().subscribe(
      (response) => {
        this.handleListResponse(response);
      },
      (error) => {
        console.log(`error fetching list ${error}`);
      }
    );
  }

  private handleListResponse(response: {
    data: ISegmentMetaData[];
    totalCount: number;
  }) {
    this.segmentMetaDataList = response.data;
    this.totalCount = response.totalCount;
    this.isLoading = false;
  }

  fetchSegments(): Observable<{
    data: ISegmentMetaData[];
    totalCount: number;
  }> {
    this.isLoading = true;
    let params = new HttpParams()

    if (this.searchValue?.length) {
      params = params.set("search", this.searchValue);
    }
    params = params.set("skip", (this.pageNumber * this.pageSize).toString());
    params = params.set("limit", (this.pageSize).toString());

    return this.segmentService.list(params);
  }

  cellClicked(segment: ISegmentMetaData, column: string): void {
    this.router.navigate(["/pages/segments/data", segment._id]);
  }
}
